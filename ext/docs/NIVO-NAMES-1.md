---
rule: NIVO-NAMES-1
concept:
  - .starciwork/concepts/tools.md
---

# NIVO-NAMES-1: a NIVO verb is never typed as text

Code `NIVO_TOOL_ID_TYPED`, severity error. Engine: ESLint rule `ext/lint/tool-ids-from-names.mjs`, loaded by the harness as
`project-ext/tool-ids-from-names`.

## What it enforces

No string literal and no template literal whose whole text is a NIVO verb (`nivo.api.*`, `nivo.tool.*`, `nivo.trigger.*`, by the SDK's id
grammar `NIVO_VERB`), and no template literal built into one (`` `nivo.tool.${x}` ``), in `packages/blocks-core/src` and
`packages/nivo-web-core/src` (`.ts`, `.tsx`). A generated names map (`*.generated.ts`) and a spec (`*.spec.ts`, `*.spec.tsx`) are not judged:
the rule leaves them out itself, since the manifest has no `excludes` key.

## Why

A package names a verb only through `TOOL` / `TRIGGER` / `API` / `PROVIDER` of `@nivo-lite/agent-sdk/names` or a generated map (`CRM`,
`CRM_API`), so a rename is one line and an undeclared verb does not compile. The concept forbids "a tool id typed as a string in code".

## Concept

`.starciwork/concepts/tools.md`: the three levels `nivo.api | nivo.tool | nivo.trigger`.

## Examples

Valid:

```ts
import { TOOL } from "@nivo-lite/agent-sdk/names"
const tools = [TOOL.customerMessageSend]
```

Invalid:

```ts
const tools = ["nivo.tool.customer.message.send"]
const id = `nivo.tool.crm.${operation}`
```
