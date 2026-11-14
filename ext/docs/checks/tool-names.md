---
check: tool-names
concept:
  - .starciwork/concepts/tools.md
---

# Project check `tool-names`

Program `ext/checks/tool-names.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` from hfs 6.9.0 on
(`HFS_PROJECT_CHECK_FAILED` when red), and by `npm run ext:check` before that.

## What it guards

No retired tool id and no id outside the three-level name law (`nivo.api | nivo.tool | nivo.trigger`) is written anywhere in the repository.

## What it runs

`node scripts/tool-names-check.mjs` (no build).

## Concept

`.starciwork/concepts/tools.md`.
