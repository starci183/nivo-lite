---
check: seed-graphs
concept:
  - .starciwork/concepts/seeds-and-data.md
---

# Project check `seed-graphs`

Program `ext/checks/seed-graphs.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` from hfs 6.9.0 on
(`HFS_PROJECT_CHECK_FAILED` when red), and by `npm run ext:check` before that.

## What it guards

Each dev seed graph (`.starcistacks/dev/seeds/data/graphs/<module>.json`) equals the installed primary graph of its template agent.

## What it runs

`npm run build:modules`, then `node scripts/seeds-graphs.mjs --check` (it reads the built SDK).

## Concept

`.starciwork/concepts/seeds-and-data.md`.
