---
rule: NIVO-GRAPHS-1
concept:
  - .starciwork/concepts/templates.md
---

# NIVO-GRAPHS-1: a template graph is serializable data

Code `NIVO_GRAPH_NOT_DATA`, severity error. Engine: ESLint rule `ext/lint/graphs-are-data.mjs` (`project-ext/graphs-are-data`).

## What it enforces

The argument of `defineTemplateGraph(...)` and of every control builder of `@nivo-lite/agent-sdk/template` (`node`, `loop`, `ifNode`,
`callWorkflow`, `callWorkflows`, `outcome`, `trigger`) holds no function expression, arrow function, method shorthand or accessor, `new`
expression, class or `await`, reached through objects, arrays, spreads, conditionals and the template entry's own calls. Identifiers, member
reads and calls of anything else are values computed when the package builds, and are fine. Scope: `packages/*/src` (`.ts`, `.tsx`); the SDK
that defines the builders (`packages/agent-sdk/**`) is left out by the rule itself, since the manifest has no `excludes` key.

## Why

"Packages describe, the engine runs": everything inside a template graph is serializable data, and every condition is the engine's
declarative expression language, never a function.

## Concept

`.starciwork/concepts/templates.md`.

## Examples

Valid:

```ts
ifNode({ when: equals(ref("steps.read.output.status"), "paid"), then: "notice", else: "end" })
```

Invalid:

```ts
ifNode({ when: (state) => state.paid, then: "notice", else: "end" })
loop({ over: ref("steps.list.output.items"), key: "id", body: { async run() {} }, max: 10, next: "end" })
```
