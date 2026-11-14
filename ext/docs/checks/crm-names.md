---
check: crm-names
concept:
  - .starciwork/concepts/tools.md
  - .starciwork/concepts/providers.md
---

# Project check `crm-names`

Program `ext/checks/crm-names.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` from hfs 6.9.0 on
(`HFS_PROJECT_CHECK_FAILED` when red), and by `npm run ext:check` before that.

## What it guards

A CRM is a provider connected through its OpenAPI document, and every operation of it has ONE name,
`nivo.api.crm.<crmId>.<method>.<path>` (a node calls it, an interface reads it). A package that supports a CRM pins the document at
`src/crm/<crmId>/openapi.json` and its codegen (`npm run crm:codegen`) writes `src/crm/<crmId>/api.generated.ts`. For every package under
`packages/*` that pins a document:

1. `api.generated.ts` equals what the SDK writes for the document (the codegen is current).
2. Every `nivo.api.crm.<crmId>.<rest>` text in the package's `src/**/*.ts` is an operation of the document of a template the SAME
   package declares for that id: a package that uses another package's CRM id, or an id it declares no template for, is a finding (a
   package that declares nothing is judged on its code only, not its comments or specs).
3. Every provider template a plugin declares (`defineProviderTemplate({ kind: "crm", id, openapi, ... })` in its `providers`, owner chốt
   2026-11-14, read from the built package) has its `src/crm/<id>/openapi.json`, and its `openapi` IS that file (compared by content); a
   pinned folder no template declares is a finding.
4. Template ids are unique across packages: two packages declaring the same id, or pinning the same `<crmId>` folder, are a finding.

A hand-named `nivo.tool.crm.` text anywhere in `packages/*/src`, `be/src` or `fe/apps/*/src` is a finding too: a CRM operation is
generated, never typed. Findings print as `file:line`.

## What it runs

`npm run build:modules`, then a pure node pass over the packages' sources and their built plugins (`providers`). The decisions of
2-4 are `ext/support/crm-names-rules.mjs`, judged on fixtures by `ext/tests/crm-names.spec.mjs` (`npm run ext:test`). The names come from the SDK's own derivation
(`crmOpsOf` and `crmNamesTextOf` of `@nivo-lite/agent-sdk/names`, from its dist), the one the engine and a package's codegen use.

## Concept

`.starciwork/concepts/tools.md`, `.starciwork/concepts/providers.md`.
