'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const rateLimit = require('express-rate-limit');

const { requireAuth, attachCsrf, verifyCsrfOrigin } = require('./auth');
const adminRouter = require('./admin');
const publicApiRouter = require('./public-api');

const app = express();
const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || `http://localhost:${PORT}`;

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('[FATAL] SESSION_SECRET must be set to 32+ chars. See .env.example');
  process.exit(1);
}

// Trust proxy when behind Nginx/Cloudflare so secure cookies and req.ip work.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.disable('x-powered-by');

// --- SECURITY HEADERS ---
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // GSAP loads from cdnjs; everything else is self-hosted.
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://cdnjs.cloudflare.com'],
      'style-src': ["'self'", "'unsafe-inline'"], // inline <style> blocks in existing HTML
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': IS_PROD ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // avoid breaking fonts across origins
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: IS_PROD ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
}));

app.use(compression());
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// --- SESSION ---
app.use(session({
  name: 'spill.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({ checkPeriod: 24 * 60 * 60 * 1000 }),
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true' || IS_PROD,
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
}));

// --- GLOBAL RATE LIMIT ---
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
}));

// --- CSRF / ORIGIN CHECKS on unsafe methods ---
app.use(verifyCsrfOrigin(PUBLIC_ORIGIN));
app.use(attachCsrf);

// --- PUBLIC READ API ---
app.use('/api', publicApiRouter);

// --- ADMIN ---
app.use('/admin', adminRouter);

// --- STATIC FILES ---
// Served after API/admin so routes take precedence.
const STATIC_OPTS = {
  maxAge: IS_PROD ? '1h' : 0,
  dotfiles: 'ignore',
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
};
app.use(express.static(ROOT, STATIC_OPTS));
app.use('/uploads', express.static(path.join(ROOT, 'public', 'uploads'), { maxAge: IS_PROD ? '7d' : 0 }));

// --- 404 ---
app.use((req, res) => {
  if (req.accepts('html')) return res.status(404).sendFile(path.join(ROOT, 'index.html'));
  res.status(404).json({ error: 'Not found' });
});

// --- ERROR HANDLER ---
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.publicMessage || (status < 500 ? err.message : 'Server error') });
});

app.listen(PORT, () => {
  console.log(`Spill running at ${PUBLIC_ORIGIN} (env=${IS_PROD ? 'production' : 'development'})`);
});
