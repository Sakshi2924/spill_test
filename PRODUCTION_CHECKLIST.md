# Production Readiness Checklist — Spill

Status legend: ✅ done, ⬜ todo, 🛠 infra (done via `DEPLOYMENT.md` when you stand up the server).

## 1. Frontend

- ✅ Semantic HTML with `<nav>`, `<main>`, `<header>`, `<footer>`, heading hierarchy
- ✅ Responsive layouts — breakpoints at 560 / 900 px; no horizontal scroll; no clipped text
- ✅ Mobile-first nav (hamburger under 900 px) with `aria-expanded` and focus trap friendly
- ✅ `prefers-reduced-motion` respected across all animations
- ✅ Fonts loaded with `font-display: swap` + `<link rel=preload>` for the regular face
- ✅ Viewport meta with `viewport-fit=cover` for notch devices
- ✅ `theme-color` set per page
- ✅ Favicon linked
- ✅ Open Graph + Twitter card meta on every page
- ✅ `<link rel="canonical">` on every page
- ✅ JSON-LD `Product` schema on all 5 flavor pages
- ✅ Subresource Integrity (SRI) on GSAP CDN `<script>` tags + `crossorigin="anonymous"`
- ✅ No cross-origin inline scripts (legacy inline blocks externalised to `assets/home.js`, `admin/login.js`)
- ⬜ Lighthouse audit (target Performance ≥ 90, Accessibility ≥ 95, Best Practices 100, SEO ≥ 95) — run pre-launch
- ⬜ WebP/AVIF variants of all product images. Script provided: `node scripts/optimize-images.js` (requires `sharp`)
- ⬜ Explicit `width`/`height` on `<img>` tags to prevent CLS
- ⬜ Service worker for offline-first (optional)

## 2. Backend

- ✅ Express app with disabled `x-powered-by`
- ✅ Sessions: `httpOnly`, `SameSite=Strict`, `Secure` in production, 8 h TTL
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ Login rate limit: 8 / 10 min / IP; 2FA rate limit: 10 / 10 min; mutations: 40 / min; global: 600 / 15 min
- ✅ Input validation via `express-validator` + allow-listed field names
- ✅ Atomic content writes (temp-file → rename)
- ✅ Upload: MIME allow-list + magic-byte check + 5 MB cap + sanitized filenames
- ✅ Structured error responses (no stack traces in production)
- ✅ `trust proxy` configurable
- ✅ Structured JSON request log (`server/logger.js`) — one line per request
- ✅ Admin audit log — append-only `data/audit.log`, captures every mutation with user, path, IP, status
- ✅ `/healthz` public endpoint for load-balancer probes
- ✅ TOTP 2FA (enrollment + verification) via `otplib`
- ✅ Graceful shutdown (SIGTERM / SIGINT) so systemd can restart cleanly
- ⬜ Metrics endpoint (`/metrics` behind internal auth) — add if/when you adopt Prometheus

## 3. Security — application layer

- ✅ CSP (via `helmet`) with scripts locked to self + cdnjs and style-src locked. See `server/index.js` for the exact policy and trade-off comment.
- ✅ HSTS in production (2 years, includeSubDomains, preload)
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `X-Content-Type-Options: nosniff` (helmet default)
- ✅ `X-Frame-Options: DENY` + CSP `frame-ancestors: 'none'`
- ✅ CSRF: Origin/Referer allow-list + `X-Requested-With: fetch` header + `SameSite=Strict`
- ✅ Session regenerated on login (defeats session fixation) and on 2FA success
- ✅ Generic login errors (no user enumeration; equal-time bcrypt compare on miss)
- ✅ `express.json` 100 kB body limit
- ✅ Admin routes require auth; public read API is unauthenticated + rate-limited
- ✅ Admin 2FA enrollment / disable
- ✅ Dependabot config for weekly npm + monthly GitHub Actions updates
- ✅ GitHub Actions CI: syntax-check, HTML reference integrity, `npm audit --audit-level=high`, CodeQL
- ⬜ CAPTCHA on login after N failed attempts (recommended: Cloudflare Turnstile) — add keys and wire up when launching
- ⬜ WebAuthn / passkeys (nice to have; 2FA is sufficient for launch)

## 4. Security — infrastructure

- 🛠 TLS via Let's Encrypt (Certbot + Nginx auto-renewal) — see `DEPLOYMENT.md §5`
- 🛠 Force HTTPS redirect at reverse proxy — see `DEPLOYMENT.md §5`
- 🛠 Cloudflare with WAF, bot scoring, rate limiting, DDoS mitigation — see `DEPLOYMENT.md §6`
- 🛠 Firewall (ufw): deny by default, allow 80 / 443 / SSH only — `DEPLOYMENT.md §2`
- 🛠 `fail2ban` on SSH and Nginx — `DEPLOYMENT.md §2`
- 🛠 systemd unit with `ProtectSystem=strict`, `PrivateTmp`, `NoNewPrivileges`, restricted `ReadWritePaths` — `DEPLOYMENT.md §4`
- 🛠 Non-root Node process user — `DEPLOYMENT.md §1`
- 🛠 Automatic OS updates (`unattended-upgrades`) — `DEPLOYMENT.md §2`

## 5. Privacy, compliance, legal

- ✅ Privacy policy, refund policy, shipping policy pages
- ✅ Terms of Service page (`terms.html`)
- ✅ Cookie consent banner (`assets/cookie-consent.js`) — records choice in localStorage, styled to match brand
- ⬜ DPDP / GDPR data-subject-request workflow (access / erase endpoints) — build when you start capturing customer accounts
- ⬜ Payments: integrate a PCI-DSS-compliant gateway (Razorpay / Stripe) — **never** handle raw card data yourself
- ⬜ Age / caffeine disclaimer if selling to minors is a concern in your jurisdiction

## 6. Performance

- ✅ `compression` (gzip) middleware
- ✅ Static assets: 1 h cache; HTML `no-cache`; uploads 7 d; robots/sitemap 1 h
- ⬜ Long-lived cache-busting (hash filenames) for CSS/JS — add when you have a build step
- ⬜ Brotli at the CDN layer (`Accept-Encoding: br`)
- ⬜ HTTP/2 or HTTP/3 at the reverse proxy (Nginx enables H/2 with `listen 443 ssl http2;` — already in the example config)
- ⬜ CDN in front (Cloudflare / BunnyCDN)
- ⬜ Image optimization pipeline on upload (generate WebP + resize variants) — script in `scripts/optimize-images.js`

## 7. Observability

- ✅ Request logging — structured JSON, one line per request, to stdout
- ✅ Admin audit log — append-only `data/audit.log`
- ⬜ Error tracking (Sentry) — DSN via env var; install `@sentry/node` and `Sentry.init()` in `server/index.js`
- ⬜ Uptime monitoring (UptimeRobot / BetterStack) — point at `/healthz`
- ⬜ Log drain (Loki / Datadog / Papertrail) — systemd journald already captures structured JSON
- ⬜ Privacy-friendly analytics (Plausible / Umami) — gated behind the cookie consent `accepted` state

## 8. CI/CD + release hygiene

- ✅ `.nvmrc` pinning Node 20
- ✅ GitHub Actions workflow (`ci.yml`): lint, HTML integrity check, npm audit, CodeQL
- ✅ Dependabot (`.github/dependabot.yml`)
- ✅ Pre-commit hook (`.githooks/pre-commit`) — refuses `.env` / users.json / media, syntax-checks staged JS, enforces viewport meta on new HTML. Enable with `git config core.hooksPath .githooks`
- ✅ Auto-push script (`auto-push.sh`) with explicit allow-list — never commits secrets / build artefacts
- ⬜ Deploy on merge to `main` (rsync via GitHub Actions → server; or container image)
- ⬜ Blue/green or rolling deploys
- ⬜ Immutable artifacts (tag releases, keep last N for fast rollback)

## 9. Operational runbook

- ✅ Incident template (`INCIDENT_TEMPLATE.md`)
- ✅ Backup script (`scripts/backup.sh`) — tars `data/` and `public/uploads/`, optionally GPG-encrypts; retention in env vars
- ✅ "Rotate SESSION_SECRET" documented in `DEPLOYMENT.md §8`
- ✅ "Reset admin password" documented in `DEPLOYMENT.md §8`
- ⬜ On-call rotation and paging (organisational, not code)
- ⬜ Practice restore drill quarterly

## 10. SEO / discoverability

- ✅ `robots.txt` — allows `/`, disallows `/admin/`, `/data/`, `/uploads/`, `/api/`; also blocks GPTBot/CCBot from those paths
- ✅ `sitemap.xml` — all 11 pages; `scripts/generate-sitemap.js` regenerates it from on-disk files
- ✅ Open Graph + Twitter card meta on every page
- ✅ Canonical URLs on every page
- ✅ JSON-LD Product schema on product pages

## 11. Accessibility

- ✅ ARIA labels on hamburger, `role=dialog` + `aria-modal` on mobile menu
- ✅ Buttons have discernible names / labels; `aria-expanded` on toggles
- ✅ Form inputs have `<label>` associations
- ✅ Color contrast meets WCAG AA for body text on brand colors
- ✅ 2FA input uses `inputmode=numeric`, `autocomplete=one-time-code`
- ⬜ Manual keyboard-nav test on every page (pre-launch QA)
- ⬜ Screen reader pass (VoiceOver / NVDA) (pre-launch QA)

## 12. Explicitly NOT done (deliberate)

- **Payments** — a payment gateway integration (Razorpay / Stripe Hosted Checkout) needs real API keys and a business decision. Keep cart + checkout on the gateway's hosted page so your server never sees card data.
- **Customer accounts** — this repo is a catalogue + admin CMS, not a shopping account system. Sign-in for buyers is a bigger scope (schema, email verification, password reset flows, cart persistence) and should live in its own iteration.
- **Transactional email** — plug in Postmark / Resend / SES when orders go live.
- **Full CSP without `'unsafe-inline'`** — requires either server-side rendering (nonce-based) or a build step that inlines-then-hashes. Acceptable as-is for now; see comment in `server/index.js`.
