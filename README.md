# Spill — Tea That Hits Different

Marketing site + product catalogue + admin CMS for Spill Tea Co.

## Stack

- **Frontend**: static HTML / CSS / JS, GSAP for motion. No build step.
- **Backend**: Node.js + Express. JSON content store, no database. Admin auth via bcrypt + signed sessions.
- **Infra (recommended)**: Nginx + Certbot in front, Cloudflare at the edge. See `DEPLOYMENT.md`.

## Project layout

```
.
├── index.html                # Landing page
├── contact.html
├── privacy-policy.html
├── shipping-returns.html
├── refund-policy.html
├── flavors/                  # Product pages
│   ├── masala-mayhem.html
│   ├── mint-riot.html
│   ├── ginger-snap.html
│   ├── berry-burst.html
│   └── classic-chaos.html
├── assets/                   # Shared CSS / JS for inner + product pages
│   ├── inner.css
│   ├── product.css
│   └── product.js
├── main images/              # Product photography
├── Spill.png                 # Logo
├── Chomp*.otf / .ttf         # Brand fonts
│
├── server/                   # Node backend
│   ├── index.js              # Express app (security, sessions, routing)
│   ├── auth.js               # bcrypt + session helpers, CSRF origin check
│   ├── storage.js            # JSON content store (atomic writes)
│   ├── upload.js             # Multer config with MIME + magic-byte validation
│   ├── admin.js              # /admin routes (login, CRUD, upload)
│   └── public-api.js         # Public read-only /api/flavors, /api/pages
│
├── admin/                    # Admin dashboard UI
│   ├── login.html
│   ├── index.html
│   └── admin.js
│
├── data/                     # Runtime data (gitignored for secrets)
│   ├── content.json          # Flavors + pages content
│   └── users.json            # Admin credentials (bcrypt hashed)
│
├── public/uploads/           # User-uploaded images
├── scripts/create-admin.js   # CLI to create the first admin
│
├── PRODUCTION_CHECKLIST.md   # Full production-readiness list
├── DEPLOYMENT.md             # Step-by-step production deploy guide
├── SECURITY.md               # Threat model + mitigations
└── README.md
```

## Local development

```bash
# 1. install deps (Node 18+ required)
npm install

# 2. copy env and fill in the secret
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# paste that into SESSION_SECRET=... in .env

# 3. create your first admin account
npm run create-admin

# 4. run the server
npm start
# → Spill running at http://localhost:3000
```

Visit:
- `http://localhost:3000/` — public site
- `http://localhost:3000/admin/login` — admin

## Admin workflow

1. Sign in at `/admin/login`.
2. **Flavors tab** — edit name/tagline/price/theme, toggle published, drag/upload images, reorder, save.
3. **Pages tab** — edit copy for contact / privacy / shipping / refund.
4. **Media tab** — bulk-upload images; copy URLs to paste into flavor fields.

All edits write atomically to `data/content.json`. The public read API at `/api/flavors` and `/api/pages/:id` reflects changes immediately. The static HTML product pages do not currently pull from JSON — if you want dynamic content, either add a client-side fetch on those pages or wire them to a template build step.

## Production deploy

See `DEPLOYMENT.md` for the full Ubuntu + Nginx + Certbot + Cloudflare walkthrough. Summary:

1. Provision a small Linux VM.
2. Clone, `npm ci --omit=dev`, set `.env`, `npm run create-admin`.
3. systemd unit runs the app as a non-root user.
4. Nginx terminates TLS and proxies to Node on 127.0.0.1:3000.
5. Cloudflare in front for WAF + DDoS + caching.

## Security posture

See `SECURITY.md` for threat model. Short summary of what's implemented:

- bcrypt (cost 12) password hashing, session regeneration on login
- `SameSite=Strict` + `httpOnly` + `Secure` cookies, 8h TTL
- CSP, HSTS, Referrer-Policy, Permissions-Policy via `helmet`
- CSRF defense: Origin/Referer check + `X-Requested-With` header + SameSite cookies
- Rate limits: global (600/15m), login (8/10m), admin mutations (40/m)
- Input validation on every admin mutation
- File uploads: MIME allow-list + magic-byte check + 5 MB cap + sanitized filenames
- Atomic content writes

## Not implemented (yet)

This is a catalogue + admin, not a full e-commerce engine. Before real customer orders:

- Payment gateway integration (Razorpay / Stripe) — **do not** build your own card handling.
- Order database + fulfillment dashboard
- Customer accounts / login
- Cookie consent banner (EU / DPDP)
- 2FA for admins
- Transactional email (Postmark / Resend)

Full list with priorities in `PRODUCTION_CHECKLIST.md`.
