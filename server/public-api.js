'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const storage = require('./storage');
const { log } = require('./logger');

const router = express.Router();

router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

// --- CONTACT FORM ---
const CONTACT_LOG = path.resolve(__dirname, '..', 'data', 'contacts.log');

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages from this address. Try again in an hour.' },
});

router.post('/contact',
  contactLimiter,
  body('name').isString().isLength({ min: 1, max: 100 }).trim(),
  body('email').isEmail().isLength({ max: 200 }).normalizeEmail(),
  body('subject').isString().isLength({ min: 1, max: 200 }).trim(),
  body('message').isString().isLength({ min: 10, max: 4000 }),
  // Honeypot — bots fill this, humans never see it.
  body('honeypot').custom(v => !v || v.length === 0).withMessage('spam'),
  (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Please check the form and try again.' });
      }
      const entry = {
        t: new Date().toISOString(),
        name: req.body.name,
        email: req.body.email,
        subject: req.body.subject,
        message: req.body.message,
        ip: req.ip,
        ua: (req.get('User-Agent') || '').slice(0, 200),
      };
      fs.mkdirSync(path.dirname(CONTACT_LOG), { recursive: true });
      fs.appendFile(CONTACT_LOG, JSON.stringify(entry) + '\n', { mode: 0o640 }, err => {
        if (err) log.error('contact.persist', { err: err.message });
      });
      log.info('contact.submit', { email: entry.email, subject: entry.subject, ip: req.ip });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

router.get('/flavours', (req, res) => {
  const c = storage.read();
  res.json(c.flavors.filter(f => f.published));
});

// Legacy alias — keep /flavors working for any cached clients.
router.get('/flavors', (req, res) => {
  const c = storage.read();
  res.json(c.flavors.filter(f => f.published));
});

router.get('/flavours/:slug', (req, res) => {
  const f = storage.getFlavor(req.params.slug);
  if (!f || !f.published) return res.status(404).json({ error: 'Not found' });
  res.json(f);
});

router.get('/pages/:id', (req, res) => {
  const c = storage.read();
  const page = c.pages[req.params.id];
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

module.exports = router;
