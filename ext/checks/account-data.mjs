#!/usr/bin/env node
// ext/manifest.json check `account-data` (doc ext/docs/checks/account-data.md; ACCOUNT-DATA-LEAD's check): the committed DDL of every
// declared account data type equals what the generator renders (.starciwork/concepts/account-data.md). Exactly one command, no
// database, no build: exit = the status of `node scripts/account-data-ddl.mjs --check`. No arguments.
import { exitWith, node } from "../support/program.mjs"

exitWith(() => node("scripts/account-data-ddl.mjs", "--check"))
