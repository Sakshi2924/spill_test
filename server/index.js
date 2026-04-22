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

const { attachCsrf, verifyCsrfOrigin } = require('./auth');
const { requestLogger, log } = require('./logger');
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

if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.disable('x-powered-by');

// Request logger first — captures every request including 4xx/5xx from later middleware.
app.use(requestLogger);

// --- SECURITY HEADERS ---
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // 'unsafe-inline' on script-src allows inline JSON-LD blocks on product pages.
      // (Browsers are inconsistent about blocking application/ld+json under strict script-src.)
      // No other inline scripts exist; all interactive JS is in /assets/*.js.
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      // 'unsafe-inline' on style-src covers per-page theme-variable <style> blocks.
      // SECURITY.md tracks the follow-up to externalise these.
      'style-src': ["'self'", "'unsafe-inline'"],
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
  crossOriginEmbedderPolicy: false,
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
    maxAge: 1000 * 60 * 60 * 8,
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

// --- CSRF / ORIGIN CHECKS ---
app.use(verifyCsrfOrigin(PUBLIC_ORIGIN));
app.use(attachCsrf);

// --- HEALTHZ (public, cheap) ---
app.get('/healthz', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()), now: Date.now() });
});

// --- PUBLIC READ API ---
app.use('/api', publicApiRouter);

// --- ADMIN ---
app.use('/admin', adminRouter);

// --- STATIC FILES ---
const STATIC_OPTS = {
  maxAge: IS_PROD ? '1h' : 0,
  dotfiles: 'ignore',
  index: 'index.html',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    if (filePath.endsWith('robots.txt') || filePath.endsWith('sitemap.xml')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
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
  if (status >= 500) log.error('unhandled', { err: err.message, stack: err.stack, path: req.originalUrl });
  res.status(status).json({ error: err.publicMessage || (status < 500 ? err.message : 'Server error') });
});

const server = app.listen(PORT, () => {
  log.info('listening', { url: PUBLIC_ORIGIN, env: IS_PROD ? 'production' : 'development', port: PORT });
});

// Graceful shutdown so systemd can restart us cleanly.
function shutdown(sig) {
  log.info('shutdown', { sig });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
