---
check: template-tools
concept:
  - .starciwork/concepts/nivo-toolset.md
  - .starciwork/concepts/records.md
---

# Project check `template-tools`

Program `ext/checks/template-tools.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` and by
`npm run ext:check`. Its decision is the pure function `defaultToolFindings` of `ext/support/template-tools-rules.mjs`; its spec is
`ext/tests/template-tools.spec.mjs`.

## The law

A template's `tools` names only tools that act outside or on other people. The two default sets of `@nivo-lite/agent-sdk/names` are the
engine's, never listed:

- `DEFAULT_NODE_TOOLS` (record, file and timer tools): every node holds them, its code and its AI step alike (`heldToolsOf`,
  `packages/agent-sdk/src/node/template-host.ts`). Never listed, no exception.
- `DEFAULT_AI_READ_TOOLS` (truth graph, thread and contact reads): every AI step holds and is shown them. A node's own code (`ctx.tools.call`)
  holds one only when the node lists it. So one stays listed in exactly two cases, and no other: the node's own code calls it (an example of the
  node scripts it under `tools`, the code-call stubs; the example runner fails on a call without a stub and on a stub never used), or the node
  `requires` it (the definition law keeps `requires` inside `tools`).
- A module agent's set (`ModuleDeclaration.agent.tools`) never lists a default: the engine adds both sets itself (`withDefaultReads`).

An AI step's `tools` subset (`ctx.agent.run({ tools })`) narrows the node's own tools only; it never names a default (source code, outside
this check's reach: the check reads the installation).

## What it runs

`npm run build:modules` (turbo, cached), then the built installation of the core package and of each plugin of the root `package.json`
`nivo.plugins`: every module agent set and every template node (placed by a template agent, once per agent, or listed by the plugin). One
line per offence `plugin  module  agent/node  tool`.

## Concept

`.starciwork/concepts/nivo-toolset.md` · `.starciwork/concepts/records.md` (Agent scope, rule 6).
