#!/usr/bin/env bash
# Backup of the engine stack state, run ON THE VPS from engine/deploy (cron-friendly):
#   BACKUP_DIR=/var/backups/nivo-engine ./backup.sh
# Writes, with the date in the name: a pg_dump of the n8n database and tarballs of the n8n, OpenClaw and Caddy volumes.
# It keeps the last KEEP_DAYS days (default 14). It does NOT copy .env (keep that in your password manager) and it does NOT move the
# files off this machine: copy BACKUP_DIR to storage in another failure domain (rclone, another VPS, object storage).
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nivo-engine}"
KEEP_DAYS="${KEEP_DAYS:-14}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
umask 077

echo "==> n8n database"
docker compose --env-file .env exec -T n8n-db pg_dump -U n8n -d n8n --format=custom > "$BACKUP_DIR/n8n-db-$stamp.dump"

# Volume names are prefixed with the compose project name (nivo-engine).
for vol in n8n-data openclaw-data caddy-data; do
  echo "==> volume $vol"
  docker run --rm -v "nivo-engine_${vol}:/src:ro" -v "$BACKUP_DIR:/out" alpine:3 tar czf "/out/${vol}-${stamp}.tgz" -C /src .
done

find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete
echo "==> done: $BACKUP_DIR (copy it off this machine)"
