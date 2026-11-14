---
check: account-data
concept:
  - .starciwork/concepts/account-data.md
---

# Project check `account-data`

Program `ext/checks/account-data.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` from hfs 6.9.0 on
(`HFS_PROJECT_CHECK_FAILED` when red), and by `npm run ext:check` before that.

## What it guards

The committed DDL of every declared account data type (`db/migrations/20261112022900_account-data-types.sql`) equals what the generator renders.

## What it runs

`node scripts/account-data-ddl.mjs --check`: exactly one command, no database, no build.

## Concept

`.starciwork/concepts/account-data.md`.
