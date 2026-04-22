// Vercel serverless function — POST /api/contact
// Paired with the client form in assets/contact.js. Validates the payload,
// trips honeypot silently, enforces same-origin via Origin/Referer + a
// custom X-Requested-With header, then logs the submission to the Vercel
// function logs. For production, forward these to email or a database by
// wiring a secret (RESEND_API_KEY, SUPABASE_URL, etc.) and sending from here.

const ALLOWED_ORIGIN_SUFFIXES = ['.vercel.app'];

function checkOrigin(req) {
  const raw = req.headers.origin || req.headers.referer || '';
  if (!raw) return false;
  let u;
  try { u = new URL(raw); } catch { return false; }
  const host = u.host;
  // Allow the current deployed host (primary + preview) and localhost during dev.
  if (host === req.headers.host) return true;
  if (/^localhost(:\d+)?$/.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host)) return true;
  if (ALLOWED_ORIGIN_SUFFIXES.some(s => host.endsWith(s))) return true;
  // Allow custom primary domain via env var if set.
  const primary = (process.env.PRIMARY_HOST || '').replace(/^https?:\/\//, '');
  if (primary && host === primary) return true;
  return false;
}

function badRequest(res, msg) {
  res.status(400).json({ error: msg });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!checkOrigin(req)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (req.headers['x-requested-with'] !== 'fetch') {
    return res.status(403).json({ error: 'Missing X-Requested-With header' });
  }

  // Vercel parses JSON bodies automatically, but guard in case of string/raw.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return badRequest(res, 'Invalid JSON'); }
  }
  if (!body || typeof body !== 'object') return badRequest(res, 'Invalid body');

  const name     = String(body.name     || '').trim();
  const email    = String(body.email    || '').trim();
  const subject  = String(body.subject  || '').trim();
  const message  = String(body.message  || '').trim();
  const honeypot = String(body.honeypot || '');

  // Trip for bots — silently succeed so they don't probe further.
  if (honeypot) return res.status(200).json({ ok: true });

  if (!name    || name.length    > 100) return badRequest(res, 'Name is required');
  if (!email   || email.length   > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequest(res, 'Valid email is required');
  }
  if (!subject || subject.length > 200) return badRequest(res, 'Subject is required');
  if (message.length < 10 || message.length > 4000) {
    return badRequest(res, 'Message must be 10–4000 characters');
  }

  const entry = {
    t: new Date().toISOString(),
    name, email, subject, message,
    ip: (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || null,
    ua: (req.headers['user-agent'] || '').toString().slice(0, 200),
  };

  // Visible in Vercel's Function Logs. Hook email / DB forwarding here:
  //   const resend = require('resend');
  //   await new resend.Resend(process.env.RESEND_API_KEY).emails.send({...});
  console.log('[contact]', JSON.stringify(entry));

  return res.status(200).json({ ok: true });
};
