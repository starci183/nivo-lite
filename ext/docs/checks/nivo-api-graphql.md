---
check: nivo-api-graphql
concept:
  - .starciwork/concepts/tools.md
  - .starciwork/concepts/mcp.md
---

# Project check `nivo-api-graphql`

Program `ext/checks/nivo-api-graphql.mjs`: no arguments, exit 0 is green. Run by the `checks` step of `starci app check` and by
`npm run ext:check`.

## What it guards

Every NIVO-owned API name (`API.nivo.*`, `nivo.api.nivo.<object>.<op>`) maps to exactly one GraphQL operation of the app's contract
(`be/contracts/api/schema.graphql`) through the declared table `NIVO_API_GRAPHQL` (`packages/agent-sdk/src/names/nivo-api-graphql.ts`).
It fails when:

- an `API.nivo.*` name has no row, or a row names an API name that is not declared;
- a row names a GraphQL field the contract does not have on that kind of root (`query` / `mutation`), or a field of the other kind;
- two API names map to the same GraphQL operation (the mapping is 1:1);
- a resolver or the contract claims an API name (`nivo.api.nivo.…`) that is not declared.

## What it runs

`npm run build -w @nivo-lite/agent-sdk` (the names are read from the built package; a build that fails is the check's failure), then the pure decisions
of `ext/support/nivo-api-graphql-rules.mjs` over the built names, the table and the SDL parsed with `graphql`. Its spec is
`ext/tests/nivo-api-graphql.spec.mjs`.

## Concept

`.starciwork/concepts/tools.md`, `.starciwork/concepts/mcp.md` (the outbound surface is generated from these declarations).
