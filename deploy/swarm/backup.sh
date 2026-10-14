#!/usr/bin/env bash
# Encrypted backup of the stack state, run on the VPS manager (or with DOCKER_HOST=ssh://...); operator-run or from an external scheduler,
# never a host crontab.
#   BACKUP_DIR=/var/backups/nivo ./backup.sh [--swarm-state]
# Writes, with the date in the name: tarballs of the n8n volume (it holds n8n's SQLite database, database.sqlite plus its -wal/-shm files, taken
# hot: run `docker service scale nivo_n8n=0` first for a guaranteed-consistent copy) and of the OpenClaw volume, each ENCRYPTED with age to the
# project recipient (backup.recipient, the same public recipient as .sops.yaml) as it is produced: the data goes straight from the producer through
# `age` into the .age file, so no plaintext tarball or temporary file ever exists on this host. Only the owner's private identity (SOPS_AGE_KEY
# in .claude/secret.env, never on the VPS) can open a backup. The job queues (pgmq) live in Supabase Postgres and are covered by its backups.
# It keeps the last KEEP_DAYS days (default 14). It does NOT move the files off this machine: copy BACKUP_DIR to storage in another failure
# domain (the files are safe to copy because they are encrypted), and prove a restore on an isolated host.
# --swarm-state also archives /var/lib/docker/swarm (orchestration state and keys; needs root; it is NOT a database backup), encrypted the same way.
# Requires `age` on the host (apt install age). Restore (on the owner's machine, identity loaded in the environment):
#   age -d -i <(printf '%s' "$SOPS_AGE_KEY") n8n-data-<stamp>.tgz.age | tar xzf - -C <volume mount>
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nivo}"
KEEP_DAYS="${KEEP_DAYS:-14}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

for vol in n8n-data openclaw-data; do
  echo "==> volume $vol"
  backup_to "${vol}-${stamp}.tgz" docker run --rm -v "nivo-engine_${vol}:/src:ro" alpine:3.21@sha256:ce64758a109eb420d874a118f87920e625e12d3634e03b4a5573fd9f6e5d3507 tar czf - -C /src .
done

if [ "${1:-}" = "--swarm-state" ]; then
  echo "==> swarm state"
  backup_to "swarm-state-${stamp}.tgz" sudo tar czf - -C /var/lib/docker swarm
fi
find "$BACKUP_DIR" -type f \( -name '*.age' -o -name '*.age.partial' \) -mtime "+$KEEP_DAYS" -delete
echo "==> done: $BACKUP_DIR (encrypted; copy it off this machine)"
