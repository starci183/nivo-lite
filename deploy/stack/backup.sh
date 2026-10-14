#!/usr/bin/env bash
# Encrypted backup of the stack state, run ON THE VPS from the stack folder (cron-friendly):
#   BACKUP_DIR=/var/backups/nivo-engine ./backup.sh
# Writes, with the date in the name: a pg_dump of the n8n database and tarballs of the n8n and OpenClaw volumes, each ENCRYPTED with age to the
# project recipient (backup.recipient, the same public recipient as .sops.yaml) as it is produced: the data goes straight from the producer
# through `age` into the .age file, so no plaintext dump, tarball or temporary file ever exists on this host. Only the owner's private
# identity (SOPS_AGE_KEY in .claude/secret.env, never on the VPS) can open a backup.
# The job queues (pgmq) live in Supabase Postgres and are covered by its backups; the api keeps no job state on this machine.
# It keeps the last KEEP_DAYS days (default 14). It does NOT move the files off this machine: copy BACKUP_DIR to storage in another
# failure domain (rclone, another VPS, object storage); the files are safe to copy because they are encrypted.
# Requires `age` on the host (apt install age). Restore (on the owner's machine, identity loaded in the environment):
#   age -d -i <(printf '%s' "$SOPS_AGE_KEY") n8n-db-<stamp>.dump.age | docker compose exec -T n8n-db pg_restore -U n8n -d n8n --clean
#   age -d -i <(printf '%s' "$SOPS_AGE_KEY") n8n-data-<stamp>.tgz.age | tar xzf - -C <volume mount>
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nivo-engine}"
KEEP_DAYS="${KEEP_DAYS:-14}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"
command -v age >/dev/null 2>&1 || { echo "backup: age is not installed (apt install age)" >&2; exit 1; }
recipient="$(grep -E '^age1[0-9a-z]{50,}$' "$here/backup.recipient" | head -n1)"
[ -n "$recipient" ] || { echo "backup: no age recipient in backup.recipient" >&2; exit 1; }
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
umask 077

# backup_to <file name> <producer command...>: runs the producer and pipes it through age into <name>.age.partial; the file only gets its
# final name when the whole pipeline succeeded, so a failed dump never leaves a truncated backup that looks valid.
backup_to() {
  local target="$BACKUP_DIR/$1.age"
  shift
  if "$@" | age -r "$recipient" -o "$target.partial"; then
    mv "$target.partial" "$target"
  else
    rm -f "$target.partial"
    echo "backup: $(basename "$target") FAILED" >&2
    return 1
  fi
}

echo "==> n8n database"
backup_to "n8n-db-$stamp.dump" docker compose --env-file .env exec -T n8n-db pg_dump -U n8n -d n8n --format=custom

# Volume names are prefixed with the compose project name (nivo-engine).
for vol in n8n-data openclaw-data; do
  echo "==> volume $vol"
  backup_to "${vol}-${stamp}.tgz" docker run --rm -v "nivo-engine_${vol}:/src:ro" alpine:3 tar czf - -C /src .
done

find "$BACKUP_DIR" -type f \( -name '*.age' -o -name '*.age.partial' \) -mtime "+$KEEP_DAYS" -delete
echo "==> done: $BACKUP_DIR (encrypted; copy it off this machine)"
