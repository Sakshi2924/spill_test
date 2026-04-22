#!/usr/bin/env bash
# Spill — nightly backup script.
# Snapshots data/ and public/uploads/ into /var/backups (or $BACKUP_DIR).
# Meant to run from cron.daily on the production server.
# After this runs, sync the tarballs off the box (B2/S3/Backblaze/etc).

set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/spill}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "[backup] REPO_DIR $REPO_DIR not found" >&2
  exit 1
fi

cd "$REPO_DIR"

# Tar data + uploads. Exclude tmp and swap files.
tar -czf "$BACKUP_DIR/spill-$TS.tar.gz" \
  --exclude='*.tmp' --exclude='*.swp' \
  data public/uploads

# Optional: encrypt with GPG if GPG_RECIPIENT is set
if [[ -n "${GPG_RECIPIENT:-}" ]]; then
  gpg --batch --yes --encrypt --recipient "$GPG_RECIPIENT" \
    --output "$BACKUP_DIR/spill-$TS.tar.gz.gpg" "$BACKUP_DIR/spill-$TS.tar.gz"
  rm "$BACKUP_DIR/spill-$TS.tar.gz"
  echo "[backup] wrote spill-$TS.tar.gz.gpg"
else
  echo "[backup] wrote spill-$TS.tar.gz (unencrypted — set GPG_RECIPIENT for at-rest encryption)"
fi

# Retention
find "$BACKUP_DIR" -maxdepth 1 -name 'spill-*.tar.gz*' -mtime +"$RETENTION_DAYS" -delete

echo "[backup] done"
