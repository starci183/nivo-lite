#!/usr/bin/env bash
# The release record on the VPS (canon: files land in /srv/<app>/releases/<release-digest>/ behind a stable pointer that moves only after
# verification; the previous accepted release stays available for a bounded rollback). Runs where `ssh vps` works (the deploy runner, or an
# operator machine). The record holds the rendered stack bytes and the release.json: names and digests only, never a secret value.
#
#   release.sh store <dir> <digest16>     upload a rendered release (stack.yaml, release.json) to /srv/nivo/releases/<digest16>/ (read-only after)
#   release.sh accept <digest16>          verified: previous := current, current := <digest16>
#   release.sh current | previous         print the digest16 the pointer names (empty when none)
#   release.sh fetch <digest16> <dir>     download a stored release for a rollback or an audit
#   release.sh list                       the stored releases, newest first, marking current and previous
set -euo pipefail
HOST="${NIVO_SSH_HOST:-vps}"
BASE="${NIVO_RELEASES_BASE:-/srv/nivo}"
remote() { ssh "$HOST" "$@"; }
digest16() { [[ "$1" =~ ^[0-9a-f]{16}$ ]] || { echo "release.sh: '$1' is not a 16-hex release digest" >&2; exit 2; }; }

cmd="${1:-}"; shift || true
case "$cmd" in
  store)
    dir="${1:?release dir}"; digest16 "${2:?digest16}"
    tar -C "$dir" -czf - stack.yaml release.json | remote "set -e; d=$BASE/releases/$2; [ -d \$d ] && chmod -R u+w \$d || mkdir -p \$d; tar -xzf - -C \$d; chmod 440 \$d/stack.yaml \$d/release.json; chmod 550 \$d"
    ;;
  accept)
    digest16 "${1:?digest16}"
    remote "set -e; cd $BASE; test -d releases/$1; if [ -L current ]; then ln -sfn \"\$(readlink current)\" previous; fi; ln -sfn releases/$1 current.new; mv -Tf current.new current"
    ;;
  current|previous)
    remote "set -e; cd $BASE 2>/dev/null && [ -L $cmd ] && basename \"\$(readlink $cmd)\" || true"
    ;;
  fetch)
    digest16 "${1:?digest16}"; mkdir -p "${2:?target dir}"
    remote "tar -C $BASE/releases/$1 -czf - stack.yaml release.json" | tar -xzf - -C "$2"
    ;;
  list)
    remote "cd $BASE/releases 2>/dev/null && ls -1t || true" | while read -r d; do
      mark=""; [ "$d" = "$("$0" current)" ] && mark=" (current)"; [ "$d" = "$("$0" previous)" ] && mark=" (previous)"; echo "$d$mark"
    done
    ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
