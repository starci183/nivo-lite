# Database backup receipt - release v0.3.1 (production, Supabase project lytjlbytgqqykenajhgr)

## Owner decision (2026-10-21)
"Prod dọn sạch với schema mới chừa mỗi hakuen": the v0.3.1 deploy applies the v0.3.x migration chain (0100..0906, including
0906 drop-origin-columns, which purges non-live business rows), then `cleanup-workspaces` keeps only the HAKUEN workspace.
Pre-authorized ("có schema mới thì restart prod lun khỏi hỏi") with a verified native backup first; this file is that backup.

## Dump taken before the deploy
- Taken: 2026-10-22T03:26:26.574Z with the native `starci app db dump --linked` (schema starci/db-backup@1, full, not schema-only).
- Location (owner machine, outside every repository):
  `D:/starci-tmp/nivo-prod-backups/demo-integrate-20261022T032626574Z/demo-integrate-20261022T032626574Z.tar.age`
- Size 6572808 bytes, sha256 `7c051d51383d9015c8beda3e7d9c71fcd9d533abf48793a738317487c00d6957`.
- age-encrypted to the project recipient of `.sops.yaml` (age header checked by the verb); no plaintext copy kept.
- Parts: roles.sql, schema.sql, auth-storage-schema.sql, data.sql, auth-storage-data.sql, rowcounts.json.
- Row counts (no values) are in the machine receipt next to the archive: 275 tables, 59426 rows
  (e.g. auth.users 3, public.workspaces 0, storage.objects 41, supabase_migrations.schema_migrations 9).
- Production holds no workspace at backup time, so `cleanup-workspaces` has nothing to remove; HAKUEN is seeded after the
  deploy (cli-deploy profile hakuen) once the owner provides its inputs.
- Storage object files live in Supabase Storage and are not in the dump; the deploy does not delete them.

## Restore path
Decrypt with the project age identity (`age -d -i <identity> <archive> | tar -x`), then restore roles, schema and data with
psql into a reset database (same as db-backup-receipt-v0.2.1.md).
