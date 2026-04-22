# Deployment Guide — Spill

Production deployment on a Linux server (Ubuntu 22.04/24.04 reference), sitting behind Cloudflare + Nginx. Assumes you already own `spilltea.com` and have DNS pointed at Cloudflare.

## 1. Provision the server

Any 1 vCPU / 1 GB RAM VM is enough for this site — Hetzner, DigitalOcean, Linode, AWS Lightsail.

```bash
# after SSH'ing in as root
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-nginx ufw fail2ban unattended-upgrades curl git

# create a system user — the Node process will run as this user, not root
adduser --system --group --home /srv/spill --shell /bin/bash spill

# install Node 20 LTS (nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

## 2. Harden the server

```bash
# firewall — deny everything by default, allow SSH + HTTP(S)
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# automatic security updates
dpkg-reconfigure -plow unattended-upgrades

# disable root SSH login, use key auth only
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

fail2ban for brute-force protection on SSH + Nginx:

```bash
# /etc/fail2ban/jail.local
[sshd]
enabled = true
maxretry = 5
bantime = 1h

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
filter  = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
```

## 3. Deploy the app

```bash
# as root, clone the repo to /srv/spill and hand ownership to the spill user
mkdir -p /srv/spill
git clone https://github.com/your-org/spill.git /srv/spill
chown -R spill:spill /srv/spill

# install deps and set env as the spill user
sudo -u spill bash <<'EOF'
cd /srv/spill
npm ci --omit=dev
cp .env.example .env
# then edit .env: SESSION_SECRET (64+ random hex chars), PUBLIC_ORIGIN, NODE_ENV=production, TRUST_PROXY=1
chmod 600 .env
npm run create-admin
EOF

# generate SESSION_SECRET quickly:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. systemd unit

`/etc/systemd/system/spill.service`:

```ini
[Unit]
Description=Spill Tea web app
After=network.target

[Service]
Type=simple
User=spill
Group=spill
WorkingDirectory=/srv/spill
EnvironmentFile=/srv/spill/.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ReadWritePaths=/srv/spill/data /srv/spill/public/uploads
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now spill
systemctl status spill    # should be active (running)
```

## 5. Nginx reverse proxy + TLS

`/etc/nginx/sites-available/spill.conf`:

```nginx
# --- HTTP → HTTPS redirect ---
server {
    listen 80;
    listen [::]:80;
    server_name spilltea.com www.spilltea.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

# --- rate-limit shared zone (10 MB → ~160k IPs) ---
limit_req_zone $binary_remote_addr zone=spill_req:10m rate=30r/s;
limit_conn_zone $binary_remote_addr zone=spill_conn:10m;

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name spilltea.com www.spilltea.com;

    # -- TLS (Certbot fills these in) --
    ssl_certificate     /etc/letsencrypt/live/spilltea.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/spilltea.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # -- security headers (doubled up with helmet for defense in depth) --
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # -- rate limiting --
    limit_req zone=spill_req burst=60 nodelay;
    limit_conn spill_conn 20;

    # -- request size cap to block large body DoS --
    client_max_body_size 6m;
    client_body_timeout 10s;
    client_header_timeout 10s;

    # -- block obvious junk --
    location ~* \.(env|git|bak|backup|swp|old)$ { deny all; }
    location ~* /\.(git|env|ssh)/ { deny all; }

    # -- proxy to Node --
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/spill.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# TLS cert
certbot --nginx -d spilltea.com -d www.spilltea.com --redirect --non-interactive --agree-tos -m admin@spilltea.com
# Certbot auto-renews via systemd timer. Verify:
systemctl list-timers | grep certbot
```

## 6. Cloudflare (recommended, free tier is enough)

1. **DNS** — orange-cloud (proxied) for `spilltea.com` and `www`.
2. **SSL/TLS** mode → **Full (strict)** — uses your Let's Encrypt cert end to end.
3. **Edge Certificates** → enable *Always Use HTTPS*, *Auto Minify* OFF (we already minify our own output), *Brotli* ON.
4. **WAF** → *Managed Rules* → enable *Cloudflare Managed Ruleset*, *OWASP Core Ruleset* (Paranoia Level 2).
5. **Bots** → *Bot Fight Mode* ON.
6. **Rate limiting** → add a rule:
   - path: `/admin/*`
   - threshold: `10 requests per 1 minute per IP`
   - action: Managed Challenge
7. **Page Rules** → `*/admin/*` → cache level Bypass, security level High.

## 7. Backups

Nightly cron on the server:

```bash
# /etc/cron.daily/spill-backup
#!/bin/bash
set -e
ts=$(date +%Y%m%d-%H%M)
tar -czf /var/backups/spill-$ts.tar.gz -C /srv/spill data public/uploads
# then rsync to off-site storage, e.g. Backblaze B2:
# b2 sync --delete /var/backups b2://spill-backups
find /var/backups -name 'spill-*.tar.gz' -mtime +14 -delete
```

```bash
chmod +x /etc/cron.daily/spill-backup
```

## 8. Day-2 ops

- **Deploy new version**:
  ```bash
  sudo -u spill bash -lc "cd /srv/spill && git pull && npm ci --omit=dev"
  systemctl restart spill
  ```
- **Rotate SESSION_SECRET**: edit `.env`, restart. All current admin sessions die; re-login needed.
- **Reset admin password**: edit `data/users.json` to remove the user, then `npm run create-admin`.
- **Tail logs**: `journalctl -u spill -f`
- **Check rate-limit bans**: `fail2ban-client status sshd`

## 9. Scale-up path (when you outgrow one box)

1. Move session store to Redis (`connect-redis`), then you can run 2+ Node instances behind Nginx upstream.
2. Put product images on S3/R2; serve via Cloudflare.
3. Move content from JSON to Postgres (SQLite-compatible schema — use `better-sqlite3` first, then `pg` at real scale).
4. Containerize with Docker → deploy to Fly.io / Render / your own k8s.
