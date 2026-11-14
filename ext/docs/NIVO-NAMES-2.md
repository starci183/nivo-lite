---
rule: NIVO-NAMES-2
concept:
  - .starciwork/concepts/tools.md
  - .starciwork/concepts/triggers.md
---

# NIVO-NAMES-2: each NIVO name is used at its own level

Code `NIVO_NAME_LEVEL_CROSSED`, severity error. Engine: ESLint rule `ext/lint/node-level-names.mjs` (`project-ext/node-level-names`).

## What it enforces

Over `packages/*/src` and `fe/` (`.ts`, `.tsx`):

1. node code (`packages/*/src/nodes/**` and any file that calls `defineTemplateNode`) imports no `API` from the names entry and no generated
   `*_API` map: a node calls tools (`TOOL`), never a provider's raw API;
2. in a file that calls `defineTemplateGraph`, the verb of every `trigger(...)` is a member of `TRIGGER`;
3. interfaces (`fe/**`, workbench specs `packages/*/src/**/specs/**`, `**/workbench/**`) import no `TOOL` and no generated tool map (a
   `*.generated` export that is neither `*_API` nor `*_PROVIDER`): an interface reads `API` / a generated `*_API` only.

## Why

`api` names are for interfaces only and `tool` names for nodes only; a trigger verb is a `TRIGGER` name. Crossing a level lets a node reach a
provider's raw API, or an interface call a node's tool, around the engine.

## Concept

`.starciwork/concepts/tools.md` (api = interfaces, tool = nodes) and `.starciwork/concepts/triggers.md` (trigger verbs are
`TRIGGER` names).

## Examples

Valid (node): `import { TOOL } from "@nivo-lite/agent-sdk/names"`. Valid (graph): `triggers: [trigger(TRIGGER.workflowCalled)]`.
Valid (fe): `import { API } from "@nivo-lite/agent-sdk/names"`.

Invalid (node): `import { API } from "@nivo-lite/agent-sdk/names"`. Invalid (graph): `triggers: [trigger(someVerb)]`.
Invalid (fe): `import { TOOL } from "@nivo-lite/agent-sdk/names"`.
