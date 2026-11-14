---
check: registry
concept:
  - .starciwork/concepts/templates.md
---

# Project check `registry`

Program `ext/checks/registry.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` from hfs 6.9.0 on
(`HFS_PROJECT_CHECK_FAILED` when red), and by `npm run ext:check` before that.

## What it guards

The generated plugin registry (`packages/plugin-registry/src/installed.ts`, `src/client/blocks.ts`) equals what the installed plugins declare.

## What it runs

`npm run build:modules` (turbo, cached: a no-op when nothing changed), then `node scripts/build-plugin-registry.mjs --check` (the generator reads the built packages).

## Concept

`.starciwork/concepts/templates.md`.
