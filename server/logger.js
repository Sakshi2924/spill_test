'use strict';

// Simple structured JSON logger. Zero runtime deps. One line per event.
// Log levels: debug, info, warn, error. Controlled by LOG_LEVEL env var (default info).

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

function emit(level, fields) {
  if (LEVELS[level] < MIN) return;
  const rec = { t: new Date().toISOString(), level, ...fields };
  // Always stringify — structured logs are machine-friendly, even in dev.
  (level === 'error' ? process.stderr : process.stdout).write(JSON.stringify(rec) + '\n');
}

const log = {
  debug: (msg, fields = {}) => emit('debug', { msg, ...fields }),
  info:  (msg, fields = {}) => emit('info',  { msg, ...fields }),
  warn:  (msg, fields = {}) => emit('warn',  { msg, ...fields }),
  error: (msg, fields = {}) => emit('error', { msg, ...fields }),
};

// Express middleware — one line per request, with response time and status.
function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    // Skip noisy health checks unless non-200.
    if (req.path === '/healthz' && res.statusCode < 400) return;
    log.info('req', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Math.round(ms * 10) / 10,
      ip: req.ip,
      ua: (req.get('User-Agent') || '').slice(0, 120),
      user: req.session?.user?.username,
    });
  });
  next();
}

module.exports = { log, requestLogger };
