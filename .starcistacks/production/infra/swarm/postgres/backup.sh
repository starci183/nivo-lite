#!/bin/sh
# Daily encrypted backup of db (the nivo-postgres-backup service). No secret is written to disk or printed:
# the password comes from the Swarm secret file, the output is encrypted to the project age RECIPIENT (public key, .sops.yaml) before it
# touches the volume, and only the owner's age identity opens it. Restore: .starcistacks/production/infra/swarm/recovery/db-runbook.md.
#
# Environment: PGHOST PGUSER PGDATABASE BACKUP_DIR BACKUP_KEEP_DAYS BACKUP_AT_UTC (HH:MM) AGE_RECIPIENT; PGPASSWORD_FILE (default
# /run/secrets/POSTGRES_PASSWORD). BACKUP_RUN_ONCE=1 takes one backup now and exits (tests and the manual run).
set -eu
set -o pipefail # a failed pg_dump must fail the pipeline, never leave an age file of a truncated dump
PGPASSWORD_FILE="${PGPASSWORD_FILE:-/run/secrets/POSTGRES_PASSWORD}"
: "${BACKUP_DIR:?}" "${BACKUP_KEEP_DAYS:?}" "${AGE_RECIPIENT:?}" "${PGHOST:?}"
BACKUP_AT_UTC="${BACKUP_AT_UTC:-19:00}"

until command -v pg_dump >/dev/null 2>&1 && command -v age >/dev/null 2>&1; do
  apk add --no-cache postgresql17-client age >/dev/null 2>&1 || { echo "backup: package install failed, retrying in 30s"; sleep 30; }
done

backup_once() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  out="$BACKUP_DIR/nivo-db-$stamp.dump.age"
  tmp="$out.partial"
  if ! PGPASSWORD="$(cat "$PGPASSWORD_FILE")" pg_dump --format=custom --compress=6 --no-password | age -r "$AGE_RECIPIENT" -o "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  mv "$tmp" "$out"
  ( cd "$BACKUP_DIR" && sha256sum "nivo-db-$stamp.dump.age" > "nivo-db-$stamp.dump.age.sha256" )
  # retention: encrypted dumps and their checksums older than BACKUP_KEEP_DAYS days
  find "$BACKUP_DIR" -maxdepth 1 -name 'nivo-db-*' -mtime +"$BACKUP_KEEP_DAYS" -delete
  echo "backup: wrote $out ($(wc -c < "$out") bytes)"
}

if [ "${BACKUP_RUN_ONCE:-0}" = "1" ]; then backup_once; exit 0; fi

touch /tmp/backup-alive
last_day=""
# a fresh volume (or one that missed a night) gets a backup at start, once the database answers
if [ -z "$(find "$BACKUP_DIR" -maxdepth 1 -name 'nivo-db-*.dump.age' -mmin -1560 | head -n 1)" ]; then
  until pg_isready -q -h "$PGHOST"; do touch /tmp/backup-alive; sleep 10; done
  if ! backup_once; then echo "backup: start-up backup failed"; fi
fi
while true; do
  touch /tmp/backup-alive
  now="$(date -u +%H:%M)"; day="$(date -u +%Y%m%d)"
  if [ "$now" = "$BACKUP_AT_UTC" ] && [ "$day" != "$last_day" ]; then
    last_day="$day"
    if ! backup_once; then echo "backup: nightly backup failed"; fi
  fi
  sleep 30
done
