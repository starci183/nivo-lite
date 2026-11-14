---
rule: NIVO-NODES-1
concept:
  - .starciwork/concepts/tools.md
---

# NIVO-NODES-1: node code holds no provider logic

Code `NIVO_NODE_PROVIDER_LOGIC`, severity error. Engine: ESLint rule `ext/lint/no-provider-logic-in-nodes.mjs`
(`project-ext/no-provider-logic-in-nodes`).

## What it enforces

In package node code (`packages/*/src/nodes/**` and any file that calls `defineTemplateNode`, within `packages/*/src`, `.ts`, `.tsx`):

- no `defineTool` / `defineEffect` / `defineNode` call (`defineNode` only in the four engine control nodes of
  `packages/blocks-core/src/nodes/core/**`);
- no comparison with a provider constant (`PROVIDER.x`, a generated `*_PROVIDER`): `===`, `!==`, `==`, `!=`, a `switch` on it or a `case`;
- no property named `dedupeKey` / `onceKey` (the replay ledger keys calls), except in the control nodes;
- no import from a `vocabulary/*effects*` module, except the core effects in the control nodes.

## Why

The NIVO engine alone defines and executes tools. Providers are adapters the ToolRunner picks; a node never branches on one, never keys a
call itself and never builds an effect payload.

## Concept

`.starciwork/concepts/tools.md`.

## Examples

Valid:

```ts
defineTemplateNode({ tools: [TOOL.orderGet], run: async (ctx) => ctx.tools.call(TOOL.orderGet, args) })
```

Invalid:

```ts
if (account.provider === PROVIDER.sepay) { /* … */ }
ctx.tools.call(TOOL.orderCreate, { dedupeKey: orderId })
import { ORDER_EFFECT } from "../../vocabulary/effects"
```
