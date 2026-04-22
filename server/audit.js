'use strict';

// Append-only admin audit log. Every state-changing admin request ends up here.
// Rotate weekly via logrotate in prod; this module only appends.

const fs = require('fs');
const path = require('path');

const LOG_PATH = path.resolve(__dirname, '..', 'data', 'audit.log');

function ensureDir() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function record(fields) {
  ensureDir();
  const entry = JSON.stringify({ t: new Date().toISOString(), ...fields }) + '\n';
  fs.appendFile(LOG_PATH, entry, { mode: 0o640 }, err => {
    if (err) process.stderr.write(`[audit] append failed: ${err.message}\n`);
  });
}

// Middleware for admin mutation routes.
function auditAdmin(action) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return; // only log successes — failures already in request log
      record({
        action,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        params: req.params,
        user: req.session?.user?.username || '(anon)',
        ip: req.ip,
        status: res.statusCode,
      });
    });
    next();
  };
}

module.exports = { record, auditAdmin, LOG_PATH };
