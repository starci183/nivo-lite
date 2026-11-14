---
check: mcp-tools
concept:
  - .starciwork/concepts/mcp.md
---

# Project check `mcp-tools`

Program `ext/checks/mcp-tools.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` and by
`npm run ext:check`.

## What it guards

The outbound MCP surface (the mcp app's `tools/list` and `initialize` instructions) is generated from the NIVO data op declarations
(`be/src/modules/domain/nivo-api/nivo-api.declarations.ts`) and the surface's tool module
(`be/src/modules/domain/mcp-endpoint/mcp-surface.tools.ts`). Its contract snapshot `be/contracts/mcp/nivo-mcp@2.tools.json` is
committed so a change of what Claude clients see is reviewed. It fails when:

- the snapshot differs from what the declarations render now (regenerate with `npm run mcp:tools`, review the diff);
- the surface lists no tool or more than 20 (few tools, good discovery: never one tool per op);
- a tool name is not client-safe (`[a-zA-Z0-9_-]`, 1 to 64) or is listed twice;
- a tool has no description, or an input / output schema that is no object schema;
- a tool lacks one of the annotations `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, or is read-only and
  destructive at once.

## What it runs

`npm run build -w @nivo-lite/agent-sdk`, then `node scripts/mcp-tools.mjs --check` (renders through `scripts/mcp-tools.entry.ts` under
ts-node with be's tsconfig paths), then the pure decisions of `ext/support/mcp-tools-rules.mjs` over the snapshot. Its spec is
`ext/tests/mcp-tools.spec.mjs`.

## Concept

`.starciwork/concepts/mcp.md` (rules 4 to 7: generated exposure, never-exposed ops, few tools, annotations).
