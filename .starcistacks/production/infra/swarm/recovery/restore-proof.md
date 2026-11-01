# Production recovery record

Status: restore proofs are owned by the production operator and not yet recorded here. No backup or restore is run by tooling in this repository.

## What is backed up

| Component | Data | Backup |
| --- | --- | --- |
| `db` | The self-hosted PostgreSQL (the `nivo-engine_postgres-data` volume, including the job outbox) | The nightly `nivo-postgres-backup` dump (age-encrypted, 14 days, volume `nivo-engine_postgres-backups`), plus the migration history in `db/migrations`; restore in `infra/swarm/recovery/db-runbook.md`. |
| `nivo-openclaw` | The `nivo-engine_openclaw-data` volume (gateway state, agents) | `starci app stack backup --env production --execute`: an age-encrypted tarball in `/srv/nivo/backups`. |
| `nivo-n8n` | The `nivo-engine_n8n-data` volume (SQLite database and workflows) | The same command, one more tarball. |
| `nivo-api` | The `nivo-engine_video-cache` volume holds re-renderable voiceover clips only; its `openclaw-data` mount is the openclaw volume above | No separate backup. |

`starci app stack backup --env production --swarm-state --execute` also archives the Swarm state (orchestration state and keys; it is not a database backup).
The tarballs stay on the VPS for 14 days. The operator copies `/srv/nivo/backups` to storage in another failure domain; the files are encrypted to the
recipient of `.sops.yaml`, and only the owner's age identity opens them.

## Restore proof to record

Restore the newest tarball of each volume on an isolated host, start the matching image, and verify: for n8n the workflows and credentials open; for
openclaw the gateway starts and its health answers; for the database a restore of the newest nightly dump into a fresh `db` (`db-runbook.md`, section 3), then the api readiness
`/readyz` against it. Record the date, the backup file name, the operator and the result here, without any secret value.
