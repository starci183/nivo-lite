---
rule: NIVO-TOOLS-1
concept:
  - .starciwork/concepts/tools.md
---

# NIVO-TOOLS-1: tools are defined in the engine

Code `NIVO_TOOL_DEFINED_OUTSIDE_ENGINE`, severity error. Engine: ESLint rule `ext/lint/tools-defined-in-engine.mjs`
(`project-ext/tools-defined-in-engine`).

## What it enforces

A `defineTool(...)` call, or an object literal assigned to a `*TOOL_SPECS` registry, appears only in these homes (scope `be/src`,
`packages/*/src`, `fe/`, `.ts` and `.tsx`):

- `be/src/modules/domain/tool-specs/**`: the engine's tool specs, the one home;
- `be/src/tests/**`, `be/src/**/*.spec.ts`: the engine's own fixtures and specs;
- `packages/agent-sdk/**`: the home of `defineTool` itself;
- `packages/blocks-core/src/shared/vocabulary/**` and `packages/nivo-web-core/src/vocabulary/crm-tools.ts`: the declared contracts that exist today,
  allowed until the engine's specs absorb them.

## Why

The NIVO engine alone defines and executes tools: tool specs (class, args, adapters per provider, owner by data) live in the engine; a plugin
declares no tool of its own.

## Concept

`.starciwork/concepts/tools.md`.

## Examples

Valid (`be/src/modules/domain/tool-specs/tool-specs.policy.ts`): `export const TOOL_SPECS = { … }`.

Invalid (`packages/nivo-web-core/src/vocabulary/mail-tools.ts`): `export const mailListTool = defineTool({ … })`.
