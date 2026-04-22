'use strict';

const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');

const {
  verifyCredentials, requireAuth,
  generateTotpSecret, totpUri, verifyTotp, verifyUserTotp,
  enable2fa, disable2fa, findUser,
} = require('./auth');
const storage = require('./storage');
const { upload, persistUpload } = require('./upload');
const { auditAdmin, record: auditRecord } = require('./audit');
const { log } = require('./logger');

const router = express.Router();
const ROOT = path.resolve(__dirname, '..');

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Try again in 10 minutes.' },
});

const twofaLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many 2FA attempts. Try again later.' },
});

const mutateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- PAGES ---
router.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/admin');
  res.sendFile(path.join(ROOT, 'admin', 'login.html'));
});

router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'index.html'));
});

// --- AUTH ---
router.post('/login',
  loginLimiter,
  body('username').isString().isLength({ min: 1, max: 60 }).trim(),
  body('password').isString().isLength({ min: 8, max: 200 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });
      const user = await verifyCredentials(req.body.username, req.body.password);
      if (!user) {
        auditRecord({ action: 'login.fail', username: String(req.body.username).slice(0, 60), ip: req.ip });
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (user.has2fa) {
        // Partial auth — caller must submit TOTP code next.
        req.session.pending2fa = { username: user.username, role: user.role, at: Date.now() };
        return res.json({ ok: true, need2fa: true });
      }
      req.session.regenerate(err => {
        if (err) return next(err);
        req.session.user = { username: user.username, role: user.role };
        auditRecord({ action: 'login.ok', username: user.username, ip: req.ip });
        res.json({ ok: true, need2fa: false });
      });
    } catch (e) { next(e); }
  }
);

router.post('/verify-2fa',
  twofaLimiter,
  body('code').isString().matches(/^\d{6}$/),
  (req, res, next) => {
    try {
      const pending = req.session.pending2fa;
      if (!pending || (Date.now() - pending.at) > 5 * 60 * 1000) {
        return res.status(401).json({ error: '2FA session expired. Re-enter credentials.' });
      }
      if (!verifyUserTotp(pending.username, req.body.code)) {
        auditRecord({ action: '2fa.fail', username: pending.username, ip: req.ip });
        return res.status(401).json({ error: 'Invalid code' });
      }
      const username = pending.username, role = pending.role;
      req.session.regenerate(err => {
        if (err) return next(err);
        req.session.user = { username, role };
        auditRecord({ action: 'login.ok.2fa', username, ip: req.ip });
        res.json({ ok: true });
      });
    } catch (e) { next(e); }
  }
);

router.post('/logout', (req, res) => {
  const username = req.session?.user?.username;
  req.session.destroy(() => {
    res.clearCookie('spill.sid');
    if (username) auditRecord({ action: 'logout', username, ip: req.ip });
    res.json({ ok: true });
  });
});

// --- API (all protected) ---
const api = express.Router();
api.use(requireAuth, mutateLimiter);

api.get('/me', (req, res) => {
  const u = req.session.user;
  const dbUser = findUser(u.username);
  res.json({ user: { ...u, has2fa: Boolean(dbUser?.totpSecret) } });
});
api.get('/csrf', (req, res) => res.json({ token: req.session.csrfToken }));

api.get('/content', (req, res, next) => {
  try { res.json(storage.read()); } catch (e) { next(e); }
});

const ALLOWED_FLAVOR_FIELDS = ['name', 'tagline', 'price', 'theme', 'published', 'short', 'images'];

api.put('/flavors/:slug',
  param('slug').isSlug(),
  body().isObject(),
  auditAdmin('flavor.update'),
  (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });
      const patch = {};
      for (const k of ALLOWED_FLAVOR_FIELDS) {
        if (k in req.body) patch[k] = req.body[k];
      }
      if ('price' in patch) patch.price = Math.max(0, Math.min(999999, Number(patch.price) || 0));
      if ('published' in patch) patch.published = Boolean(patch.published);
      if ('name' in patch) patch.name = String(patch.name).slice(0, 100);
      if ('tagline' in patch) patch.tagline = String(patch.tagline).slice(0, 200);
      if ('short' in patch) patch.short = String(patch.short).slice(0, 600);
      if ('theme' in patch && !/^#[0-9a-fA-F]{6}$/.test(String(patch.theme))) {
        return res.status(400).json({ error: 'theme must be a hex color like #d42518' });
      }
      if ('images' in patch) {
        if (!Array.isArray(patch.images)) return res.status(400).json({ error: 'images must be an array' });
        patch.images = patch.images.slice(0, 10).map(x => String(x).slice(0, 500));
      }
      const updated = storage.updateFlavor(req.params.slug, patch);
      res.json({ ok: true, flavor: updated });
    } catch (e) { next(e); }
  }
);

const ALLOWED_PAGE_IDS = new Set(['contact', 'privacy-policy', 'shipping-returns', 'refund-policy', 'terms']);
api.put('/pages/:id',
  param('id').isIn([...ALLOWED_PAGE_IDS]),
  body('title').optional().isString().isLength({ max: 200 }),
  body('body').optional().isString().isLength({ max: 20000 }),
  auditAdmin('page.update'),
  (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid input' });
      const patch = {};
      if ('title' in req.body) patch.title = String(req.body.title);
      if ('body' in req.body) patch.body = String(req.body.body);
      const updated = storage.updatePage(req.params.id, patch);
      res.json({ ok: true, page: updated });
    } catch (e) { next(e); }
  }
);

api.post('/upload',
  auditAdmin('upload'),
  upload.single('file'),
  async (req, res, next) => {
    try {
      const result = await persistUpload(req.file);
      res.json({ ok: true, ...result });
    } catch (e) { next(e); }
  }
);

// --- 2FA endpoints ---
api.post('/2fa/enroll-start', auditAdmin('2fa.enroll.start'), (req, res) => {
  const secret = generateTotpSecret();
  req.session.enroll2fa = { secret, at: Date.now() };
  res.json({
    secret,
    uri: totpUri(req.session.user.username, secret),
  });
});

api.post('/2fa/enroll-confirm',
  body('code').isString().matches(/^\d{6}$/),
  auditAdmin('2fa.enroll.confirm'),
  (req, res) => {
    const enroll = req.session.enroll2fa;
    if (!enroll || Date.now() - enroll.at > 10 * 60 * 1000) {
      return res.status(400).json({ error: 'Enrollment expired. Start again.' });
    }
    if (!verifyTotp(enroll.secret, req.body.code)) {
      return res.status(401).json({ error: 'Code did not match. Try again.' });
    }
    enable2fa(req.session.user.username, enroll.secret);
    delete req.session.enroll2fa;
    res.json({ ok: true });
  }
);

api.post('/2fa/disable',
  body('code').isString().matches(/^\d{6}$/),
  auditAdmin('2fa.disable'),
  (req, res) => {
    if (!verifyUserTotp(req.session.user.username, req.body.code)) {
      return res.status(401).json({ error: 'Invalid code' });
    }
    disable2fa(req.session.user.username);
    res.json({ ok: true });
  }
);

router.use('/api', api);

module.exports = router;
