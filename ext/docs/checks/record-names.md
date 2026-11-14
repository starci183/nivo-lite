---
check: record-names
concept:
  - .starciwork/concepts/records.md
---

# Project check `record-names`

Program `ext/checks/record-names.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` (`HFS_PROJECT_CHECK_FAILED`
when red), and by `npm run ext:check`.

## What it guards

The records frame's name law over every installed plugin (the core package and each plugin of the root `package.json` `nivo.plugins`):

- the plugin's `packageName` is its package's npm name without the scope (`blocks-core`, `nivo-web-core`);
- every record type is `<package>.<agent>.<domain>`: `<package>` the plugin's `packageName`, `<agent>` a template agent the plugin declares;
- every read that reaches records (an entity port) is `<package>.<agent>.api.<domain>.<query>` of the same package and agents;
- a ref (`relations`) and a record read reach only types of their own agent (`RECORD_REF_OTHER_AGENT`, `RECORD_QUERY_OTHER_AGENT`;
  `engine.entities`, every type, counts as another agent's).

No type is exempt: the engine's own bookkeeping (runs, graphs, workflows, the effect ledger, stops, freezes, holds, memory) is core tables,
never records. Each offence is printed with the plugin that declares it; the owner renames their own types.

## What it runs

`npm run build:modules` (turbo, cached), then `recordLawProblems` of `@nivo-lite/agent-sdk/installation` over the built plugins and the
package-name rule of `ext/support/record-checks-rules.mjs`.

## Concept

`.starciwork/concepts/records.md`.
