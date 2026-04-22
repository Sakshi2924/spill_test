'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.resolve(__dirname, '..', 'data', 'users.json');

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return { users: [] }; }
}

function writeUsers(data) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function verifyCredentials(username, password) {
  const data = readUsers();
  const user = data.users.find(u => u.username === username);
  if (!user) {
    // Equal-time comparison to reduce user-enumeration signal.
    await bcrypt.compare(password, '$2a$12$' + 'x'.repeat(53));
    return null;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? { username: user.username, role: user.role || 'admin' } : null;
}

async function createUser(username, password, role = 'admin') {
  if (!username || !password || password.length < 12) {
    throw new Error('Password must be at least 12 characters.');
  }
  const data = readUsers();
  if (data.users.find(u => u.username === username)) {
    throw new Error('User already exists.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  data.users.push({ username, passwordHash, role, createdAt: new Date().toISOString() });
  writeUsers(data);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.accepts('html')) return res.redirect('/admin/login');
  return res.status(401).json({ error: 'Not authenticated' });
}

// Origin/Referer check for state-changing requests — defends against CSRF.
// Paired with SameSite=Strict cookies + a custom header requirement on JSON endpoints.
function verifyCsrfOrigin(publicOrigin) {
  const ALLOW = new Set([publicOrigin]);
  return (req, res, next) => {
    const m = req.method.toUpperCase();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();

    // Allow login form POST from same host (checked via Origin/Referer).
    const origin = req.get('Origin') || req.get('Referer') || '';
    if (!origin) return res.status(403).json({ error: 'Origin required' });
    try {
      const u = new URL(origin);
      const normalized = `${u.protocol}//${u.host}`;
      if (!ALLOW.has(normalized)) {
        return res.status(403).json({ error: 'Origin not allowed' });
      }
    } catch {
      return res.status(403).json({ error: 'Invalid origin' });
    }

    // For JSON endpoints require X-Requested-With header — cross-origin forms
    // cannot set custom headers without a CORS preflight, which we don't allow.
    if ((req.is('json') || req.path.startsWith('/admin/api')) &&
        req.get('X-Requested-With') !== 'fetch') {
      return res.status(403).json({ error: 'Missing X-Requested-With header' });
    }
    next();
  };
}

// Token issued per-session, returned in a cookie + exposed via GET /admin/api/csrf.
function attachCsrf(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  next();
}

module.exports = {
  readUsers,
  verifyCredentials,
  createUser,
  requireAuth,
  verifyCsrfOrigin,
  attachCsrf,
};
