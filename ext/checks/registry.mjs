#!/usr/bin/env node
// ext/manifest.json check `registry` (doc ext/docs/checks/registry.md): the generated plugin registry equals what the installed plugins
// declare (.starciwork/concepts/templates.md). No arguments; exit 0 green, else the failing step's status.
// It BUILDS FIRST: `node scripts/build-plugin-registry.mjs --check` reads the built packages, and the check contract has no `needs`, so this
// program runs `npm run build:modules` itself (idempotent: turbo's cache makes an unchanged build a no-op; it writes dist/ only).
import { buildModules, exitWith, node } from "../support/program.mjs"

exitWith(buildModules, () => node("scripts/build-plugin-registry.mjs", "--check"))
