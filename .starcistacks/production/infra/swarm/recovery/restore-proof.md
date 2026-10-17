# Production recovery record

Status: restore proofs are owned by the production operator and not yet recorded here. No backup or restore is run by tooling in this repository.

## What is backed up

| Component | Data | Backup |
| --- | --- | --- |
| `supabase` | The managed Supabase project: database (including the pgmq job queues), auth and storage | Supabase managed backups of the project, plus the migration history in `supabase/migrations`. |
| `nivo-openclaw` | The `nivo-engine_openclaw-data` volume (gateway state, agents) | `starci app stack backup --env production --execute`: an age-encrypted tarball in `/srv/nivo/backups`. |
| `nivo-n8n` | The `nivo-engine_n8n-data` volume (SQLite database and workflows) | The same command, one more tarball. |
| `nivo-api` | The `nivo-engine_video-cache` volume holds re-renderable voiceover clips only; its `openclaw-data` mount is the openclaw volume above | No separate backup. |

`starci app stack backup --env production --swarm-state --execute` also archives the Swarm state (orchestration state and keys; it is not a database backup).
The tarballs stay on the VPS for 14 days. The operator copies `/srv/nivo/backups` to storage in another failure domain; the files are encrypted to the
recipient of `.sops.yaml`, and only the owner's age identity opens them.

## Restore proof to record

Restore the newest tarball of each volume on an isolated host, start the matching image, and verify: for n8n the workflows and credentials open; for
openclaw the gateway starts and its health answers; for Supabase a point-in-time or snapshot restore into a scratch project, then the api readiness
`/readyz` against it. Record the date, the backup file name, the operator and the result here, without any secret value.
