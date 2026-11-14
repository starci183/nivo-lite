---
check: engine-business-contracts
concept:
  - .starciwork/concepts/layers.md
  - .starciwork/concepts/providers.md
  - .starciwork/concepts/triggers.md
  - .starciwork/concepts/project-ext.md
---

# Project check `engine-business-contracts`

Program `ext/checks/engine-business-contracts.mjs`: no arguments, no build, exit 0 is green. Run by the `checks` step of `starci app check` and by
`npm run ext:check`. Its decision is the pure functions of `ext/support/engine-business-contracts-rules.mjs`; its spec is
`ext/tests/engine-business-contracts.spec.mjs`.

## The law

The engine names no service contract of one module's business, and a provider offers only its three faces. Everything is decided from what the code
DECLARES and CALLS, read with the TypeScript compiler API; no name, word or pattern decides a meaning.

- **Contract.** A const initialised by a call of the imported `defineServiceContract`; its id is the string given to the call. A same-named local
  function or a string is no contract.
- **A. Declarations and references.** Every declaration in `packages/agent-sdk/src/**` (not a spec, not a fixture) and in `be/**` (not a spec, not
  `be/src/tests/**`, not the composition root) whose id is not on the generic list is a finding (`sdk-declaration`, `engine-declaration`). Every file of
  `be/**` (same exemptions) that imports, re-exports or reaches through `import * as ns` / `ns.X` a contract off the list is a finding
  (`engine-reference`, one per file and contract, the later uses listed); a re-export, an alias const, an `export *` and a relative reach into
  agent-sdk are followed to the declaration. An id written as a string in the engine is a finding too (`engine-id-literal`). References in
  `be/src/tests/**` support files are printed and not counted.
- **The generic list** is read from the table "Generic service contracts the engine may look up" of `.starciwork/concepts/layers.md` (id and the reason
  it is generic for every agent); it is not coded. A missing section or a row without a reason fails the check.
- **B. A domain module only around a contract.** A folder of `be/src/modules/domain/` in which every non-spec file that declares a decorated class
  references a contract off the list or imports (inside the folder) a file that does is named: `domain module <name> exists only around contract <id>`.
  The folder name decides nothing.
- **C. Provider modules.** A folder of `be/src/modules/domain/` is a provider module when a non-spec class of it has an `onModuleInit` that calls a
  method of a member typed with a provider registry (a class declaring `register` and `of`, or a subclass of one), as
  `this.registry.register(this.compose)`: it offers its implementation to the registry once at boot. Among the `be/src/modules/domain/*` pieces its
  non-spec files import only itself, another provider module, and the pieces of the table "Allowed imports of a provider module" of
  `.starciwork/concepts/providers.md` (piece, form `any` or `type-only`, reason). A value import of a `type-only` piece is a finding. `platform`,
  `integrations` and `queues` imports are not limited by this part.
- **D. The one event pipeline** ([triggers](../../../.starciwork/concepts/triggers.md) rule 13 and its section "The one event pipeline: what
  the gate reads", three tables; nothing in code names them):
  - **D1, a trigger declaration is pure.** A file of `be/src` (no spec, no `be/src/tests/**`) that declares an object literal with `translate`,
    `verb` and `raw` (the declaration's shape) imports VALUES only from files of its own domain folder and the entries of the table "Schema
    libraries a provider trigger declaration may import" (a package, or the exact entry such as `@nivo-lite/agent-sdk/names`). A type-only
    import is free: a type reads and writes nothing. Finding `provider trigger declaration (translate at line N) imports X: <why>`.
  - **D2, one delivery function.** The rows of kind `writer` of the table "Delivery callers of the wake writer" are `file#Class` (the wake door
    and the tag door). A file of `be/src` (same exemptions) that imports one of those classes, through any re-export (`@modules/...`, a
    relative path, an `index.ts`, `export *`, an alias), is in a writer's own domain folder or is a row of kind `caller`; any other is a
    finding `imports the wake writer (Name) outside the one delivery function and its listed callers`.
  - **D3, the trigger scope is generic.** In each row of kind `file` of the table "Generic members of the trigger scope", every element
    `{ name: "<m>" }` of a const whose declared type names `SuppliedParam`, and of every `supplies: [...]` literal, is a row of kind `member`.
    A verb's own members are its `data` (typed `DataMember`), never a top member. A listed file that is missing is a finding too.
  A missing table, a row without a reason or a bad kind fails the check before any finding.

## Why

A contract the engine looks up for one module is that module's business in the engine under another name (`chat-records`, the sales ledger), and a
provider that imports contacts, chat or records writes business inside an adapter ([layers](../../../.starciwork/concepts/layers.md) rule 14,
[providers](../../../.starciwork/concepts/providers.md) rule 13).

## How to fix a finding

- A contract reference: move the business behind the generic family (a module serves its own tools through `engine.plugin-tools`), then delete the
  contract. Never add a row to the generic table for a business contract; a row needs the reason it is generic for every agent.
- A provider import: the provider keeps API operations, tools and triggers; what it wrote through the piece moves to the module that owns the data
  or to a node, and the engine reaches people and conversations itself.

## Output

One line per finding `file:line  <what>`, then the declarations, the generic list and the provider modules found, then
`engine business contracts: <n> finding(s): <counts by kind>; <n> domain module(s) only around a contract; <n> provider import(s) outside the allowed set (<per provider>); <n> event pipeline finding(s) (<per part: translate, delivery, scope>)`.
Exit 1 on any finding.

## Concept

`.starciwork/concepts/layers.md` rule 14 and its table; `.starciwork/concepts/providers.md` rule 13 and its table; `.starciwork/concepts/triggers.md` rule 13 and its three tables.
