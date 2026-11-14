#!/usr/bin/env node
// ext/manifest.json check `seed-graphs` (doc ext/docs/checks/seed-graphs.md): each dev seed graph equals the installed primary graph of its
// template agent (.starciwork/concepts/seeds-and-data.md). No arguments; exit 0 green, else the failing step's status.
// It BUILDS FIRST: `node scripts/seeds-graphs.mjs --check` reads the built SDK, and the check contract has no `needs`, so this program runs
// `npm run build:modules` itself (idempotent: turbo's cache; dist/ only). It never regenerates the registry or a seed: a check writes no source.
import { buildModules, exitWith, node } from "../support/program.mjs"

exitWith(buildModules, () => node("scripts/seeds-graphs.mjs", "--check"))
