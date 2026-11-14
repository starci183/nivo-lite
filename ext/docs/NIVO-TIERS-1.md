---
rule: NIVO-TIERS-1
concept:
  - .starciwork/concepts/templates.md
---

# NIVO-TIERS-1: each node tier stays in its home

Code `NIVO_TEMPLATE_TIER_HOME`, severity error. Engine: ESLint rule `ext/lint/template-tier-homes.mjs` (`project-ext/template-tier-homes`).

## What it enforces

- Under `packages/**`, `defineNode` (the engine's node tier) is imported or re-exported only by its home `packages/agent-sdk/**` and by the
  engine control nodes `packages/blocks-core/src/nodes/core/**`; every other package node is a `defineTemplateNode`.
- Under `be/src/**`, `defineTemplateNode` / `defineTemplateGraph` / `defineTemplateAgent` (the package tiers) are not imported, except by the
  engine's fixtures `be/src/tests/**` and specs `*.spec.ts`. A type-only import is no use of a tier.

## Why

Packages describe templates; the engine holds running nodes as data in its database. A package writing an engine node, or the engine writing
a template of its own, mixes the two tiers.

## Concept

`.starciwork/concepts/templates.md` (rule 1: template tier in packages, running tier `defineNode` in the engine's DB).

## Examples

Valid (`packages/blocks-core/src/nodes/sales/x.node.ts`): `import { defineTemplateNode } from "@nivo-lite/agent-sdk/template"`.

Invalid (`packages/blocks-core/src/nodes/sales/x.node.ts`): `import { defineNode } from "@nivo-lite/agent-sdk/node"`.
Invalid (`be/src/modules/domain/x/x.service.ts`): `import { defineTemplateGraph } from "@nivo-lite/agent-sdk/template"`.
