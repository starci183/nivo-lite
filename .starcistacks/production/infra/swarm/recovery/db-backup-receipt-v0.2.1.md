# Database backup receipt - release v0.2.1 (production, Supabase project lytjlbytgqqykenajhgr)

## Owner decision (2026-10-17)
Wipe all, including auth: the production database is reset and the migration chain 20261026000000..20261026000600 is applied on an empty schema.
No application data and no Supabase Auth users are kept in production. Storage objects are kept. The pre-reset database exists only in the dump below.

## Dump taken before the reset
- Taken: 2026-10-17T10:38:35Z, read-only `supabase db dump --linked` (owner-approved for this cutover).
- Location (owner machine, outside every repository): `D:/starci-tmp/nivo-a18/backup/20261017T103835Z/nivo-prod-20261017T103835Z.tar.age`
- Size 46255320 bytes, sha256 `00c31e866b2cbfbaf4e16c645fcead43cc7b91d62b097aa16824b33d2cb9b2ad`.
- age-encrypted to the project recipient of `.sops.yaml`; decrypt and untar verified; the plaintext copy was deleted.
- Contents: roles.sql (cluster roles), schema.sql (app schemas), schema-auth-storage.sql, data.sql (COPY data, incl. auth), data-auth-storage.sql.
  Row counts per table (no values) are in `rowcounts.txt` next to the archive (128 tables, e.g. auth.users 10, storage.objects 41, workspaces 13).
- Storage object files live in Supabase Storage and are not in the dump; they are not deleted by the reset.

## History before the reset
Remote: 20261013142504, 20261013142505, 20261020110000, 20261020110100, 20261020110200 (the archived v0.1.4 chain).

## Restore path
Decrypt with the project age identity (`age -d -i <identity> <archive> | tar -x`), then restore roles, schema and data with psql into a reset database.
