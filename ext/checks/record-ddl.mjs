#!/usr/bin/env node
// ext/manifest.json check `record-ddl` (doc ext/docs/checks/record-ddl.md): the committed `db/entities.manifest.json` and `db/entities.ddl.sql`
// equal what the record type declarations render (.starciwork/concepts/records.md: DDL generated from the declarations, keys unique per
// workspace and agent, one index per contact field). No database. No arguments; exit 0 green, else the status of the comparison, which
// prints the files that drifted and the command that regenerates them.
// It BUILDS FIRST (`npm run build:modules`, turbo-cached): the declarations and the planner are read from the built packages.
import { buildModules, exitWith, node } from "../support/program.mjs"

exitWith(buildModules, () => node("scripts/records-ddl.mjs", "--check"))
