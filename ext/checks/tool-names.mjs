#!/usr/bin/env node
// ext/manifest.json check `tool-names` (doc ext/docs/checks/tool-names.md): no retired tool id and no id outside the three-level name law
// is written anywhere (.starciwork/concepts/tools.md). No arguments, no build; exit = the status of `node scripts/tool-names-check.mjs`.
import { exitWith, node } from "../support/program.mjs"

exitWith(() => node("scripts/tool-names-check.mjs"))
