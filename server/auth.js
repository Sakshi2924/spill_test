'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');

// Standard TOTP window ± 1 (30s each side) — tolerant of small clock drift.
authenticator.options = { window: 1 };

const USERS_FILE = path.resolve(__dirname, '..', 'data', 'users.json');

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return { users: [] }; }
}

function writeUsers(data) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function findUser(username) {
  const data = readUsers();
  return data.users.find(u => u.username === username) || null;
}

async function verifyCredentials(username, password) {
  const user = findUser(username);
  if (!user) {
    // Equal-time compare to minimise user-enumeration signal.
    await bcrypt.compare(password, '$2a$12$' + 'x'.repeat(53));
    return null;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return {
    username: user.username,
    role: user.role || 'admin',
    has2fa: Boolean(user.totpSecret),
  };
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

function updateUser(username, patch) {
  const data = readUsers();
  const idx = data.users.findIndex(u => u.username === username);
  if (idx === -1) throw new Error('User not found');
  data.users[idx] = { ...data.users[idx], ...patch, username };
  writeUsers(data);
  return data.users[idx];
}

function generateTotpSecret() {
  return authenticator.generateSecret();
}

function totpUri(username, secret, issuer = 'Spill Admin') {
  return authenticator.keyuri(username, issuer, secret);
}

function verifyTotp(secret, code) {
  if (!secret || !code || !/^\d{6}$/.test(String(code).trim())) return false;
  try { return authenticator.check(String(code).trim(), secret); }
  catch { return false; }
}

function verifyUserTotp(username, code) {
  const user = findUser(username);
  if (!user || !user.totpSecret) return false;
  return verifyTotp(user.totpSecret, code);
}

function enable2fa(username, secret) {
  updateUser(username, { totpSecret: secret, totpEnabledAt: new Date().toISOString() });
}

function disable2fa(username) {
  const data = readUsers();
  const idx = data.users.findIndex(u => u.username === username);
  if (idx === -1) throw new Error('User not found');
  delete data.users[idx].totpSecret;
  delete data.users[idx].totpEnabledAt;
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

    if ((req.is('json') || req.path.startsWith('/admin/api') || req.path.startsWith('/admin/verify-2fa')) &&
        req.get('X-Requested-With') !== 'fetch') {
      return res.status(403).json({ error: 'Missing X-Requested-With header' });
    }
    next();
  };
}

function attachCsrf(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  next();
}

module.exports = {
  readUsers,
  findUser,
  verifyCredentials,
  createUser,
  updateUser,
  requireAuth,
  verifyCsrfOrigin,
  attachCsrf,
  generateTotpSecret,
  totpUri,
  verifyTotp,
  verifyUserTotp,
  enable2fa,
  disable2fa,
};
