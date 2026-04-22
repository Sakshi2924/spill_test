# Security — Threat Model and Mitigations

A short, specific map of what can go wrong and where in the stack it is addressed. Read alongside `PRODUCTION_CHECKLIST.md` and `DEPLOYMENT.md`.

## Assets worth protecting

1. **Admin credentials** — break these, attacker edits site copy, uploads malicious files.
2. **Customer PII** (email, shipping address, phone) — not stored yet, but will be once checkout lands.
3. **Payment data** — **must** live with a PCI-DSS-compliant processor (Razorpay/Stripe), never on your server. Use Razorpay Hosted Checkout or Stripe Elements.
4. **Site availability** — downtime costs sales and SEO.
5. **Site integrity** — defacement / supply-chain attacks damage brand trust.

## Threats → mitigations

### Credential stuffing / brute force on `/admin/login`
- bcrypt password hash (12 rounds) → slow per-guess [`server/auth.js`]
- Rate limit 8 attempts / 10 min / IP [`server/admin.js`]
- Generic error message + equal-time compare → no user enumeration
- Cloudflare Turnstile or rule-based challenge at the edge [`DEPLOYMENT.md §6`]
- **Recommend**: add TOTP 2FA for admins before public launch

### Session hijacking / fixation
- `httpOnly` + `Secure` + `SameSite=Strict` session cookies [`server/index.js`]
- `req.session.regenerate()` on login → new session ID, old is invalidated
- 8-hour idle TTL — shorter than typical desktop session
- HSTS forces HTTPS so cookies never leak in cleartext

### CSRF (cross-site request forgery)
Multi-layer defense:
1. `SameSite=Strict` on the session cookie → browsers won't send it on cross-site navigation.
2. Origin/Referer check on every non-GET request [`server/auth.js verifyCsrfOrigin`].
3. `X-Requested-With: fetch` required on all JSON admin endpoints — cross-origin HTML forms cannot set custom headers without a CORS preflight, which we never grant.

### XSS (cross-site scripting)
- Admin UI escapes all user-controlled strings (`escape()` in `admin/admin.js`) before DOM insertion.
- CSP restricts `script-src` to `'self'` + the GSAP CDN — no inline scripts, no remote scripts anywhere else [`server/index.js`].
- `X-Content-Type-Options: nosniff` prevents browsers from guessing content types.
- Uploaded files get random filenames and are served as static assets with correct `Content-Type` — they can't be executed as HTML/JS.
- **Action item**: move the inline `<style>` blocks in legacy HTML to external `.css` so CSP can drop `'unsafe-inline'` style. (That is the only remaining CSP soft spot.)

### SQL injection
- No SQL in the stack. Content lives in JSON. If/when you migrate to Postgres/SQLite, use parameterized queries (`?` placeholders or `$1/$2`). Never string-concatenate queries.

### File upload abuse
- MIME allow-list: PNG, JPG, WebP, GIF only [`server/upload.js`]
- Magic-byte check on file contents — rejects files whose content doesn't match declared MIME.
- Size cap (5 MB, configurable).
- Filename sanitized + prefixed with timestamp + random token — no path traversal, no collisions.
- Uploads stored outside web root in `public/uploads/` and served via `express.static` which forces a safe `Content-Type`.
- Nginx `client_max_body_size 6m` gives an extra layer at the edge [`DEPLOYMENT.md §5`].

### SSRF (server-side request forgery)
- Server does not make outbound HTTP requests based on user input. Nothing to exploit.

### Clickjacking
- CSP `frame-ancestors: 'none'` + `X-Frame-Options: DENY` via helmet.

### Denial of service
- App-level rate limits: 600 req / 15 min globally, 40 req / min for admin mutations, 8 login attempts / 10 min.
- Nginx: `limit_req` + `limit_conn` at the edge.
- Cloudflare: DDoS protection + Bot Fight Mode + rate-limiting rules.
- `express.json({limit:'100kb'})` prevents large-body CPU exhaustion.
- Request body timeouts in Nginx (`client_body_timeout 10s`) kill Slowloris.

### Supply-chain (npm dependency) attacks
- Lockfile committed (`package-lock.json` generated on `npm ci --omit=dev`).
- Minimal deps — only 10 direct dependencies, all widely used.
- CI step: `npm audit --omit=dev --audit-level=high` should fail the build on high-severity CVEs.
- Enable Dependabot or Renovate on the repo.
- GSAP script from cdnjs should add SRI (`integrity=sha384-...`) + `crossorigin=anonymous` before launch.

### OS / server compromise
- Node runs as non-root `spill` user.
- systemd hardening: `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, `ReadWritePaths` restricted to `data/` and `uploads/`.
- Automatic security updates (`unattended-upgrades`).
- SSH hardened: key-only, no root login, fail2ban.
- ufw: deny-by-default, only 80/443 open (plus SSH, which fail2ban protects).

### Data loss
- Atomic writes (`tmp → rename`) — no partial writes on crash.
- Nightly encrypted off-site backups of `data/` and `public/uploads/` [`DEPLOYMENT.md §7`].
- Practice a restore drill quarterly.

### Insider threat / compromised admin
- `data/users.json` stored with `0600` permissions.
- Admin actions should be logged (future work: add append-only audit log of all PUT/POST to `/admin/api/*`).
- Rotate `SESSION_SECRET` if you suspect compromise — kills all sessions.

## Reporting a vulnerability

Email security@spilltea.com. PGP key optional. Please give 90 days before public disclosure.
