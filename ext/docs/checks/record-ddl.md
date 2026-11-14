---
check: record-ddl
concept:
  - .starciwork/concepts/records.md
---

# Project check `record-ddl`

Program `ext/checks/record-ddl.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` (`HFS_PROJECT_CHECK_FAILED`
when red), and by `npm run ext:check`.

## What it guards

The committed `db/entities.manifest.json` (the names the harness db drift gate reads) and `db/entities.ddl.sql` (the DDL a fresh database
gets for the partitions of `public.records`: CHECKs per field, declared indexes, keys unique per workspace AND agent, one index per contact
field, typed views) equal what the installed record type declarations render. The manifest is compared as JSON, the DDL byte for byte.

## What it runs

`npm run build:modules` (turbo, cached), then `node scripts/records-ddl.mjs --check` (`npm run records:check`). No database: the DDL is the
planner's own steps against a fresh catalog (`entitiesDdlOf`), the same renderer `cli entities plan --write` uses. On drift it names the files
and the command: `npm run build:modules && npm run records:ddl`.

## Concept

`.starciwork/concepts/records.md`.
