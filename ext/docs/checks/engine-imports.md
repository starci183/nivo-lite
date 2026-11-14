---
check: engine-imports
concept:
  - .starciwork/concepts/layers.md
---

# Project check `engine-imports`

Program `ext/checks/engine-imports.mjs`: no arguments, no build, exit 0 is green. Run by the `checks` step of `starci app check` and by
`npm run ext:check`. Its decision is the pure function `engineImportFindings` of `ext/support/engine-imports-rules.mjs`; its spec is
`ext/tests/engine-imports.spec.mjs`.

## The law

The engine holds no business. It is told what a plugin declares; it never names a plugin.

- `be/**` (production code, specs and tests alike) and the front end (`fe/apps/*/src/**`, `fe/packages/*/src/**`) import neither `@nivo-lite/blocks-core` nor `@nivo-lite/nivo-web-core`, under any
  subpath, in any form (`import`, `import type`, `export ... from`, `import x = require()`, `import()`, `require()`, and the jest calls that name a module such as `jest.mock("pkg")`).
- `@nivo-lite/plugin-registry` (and `/client`) is imported only in the composition roots, listed in ONE constant `COMPOSITION_ROOTS` of
  `ext/support/engine-imports-rules.mjs` (path -> the packages it may import): the engine's `installed.policy.ts`, the engine's test root
  `be/src/tests/fixtures/builders/installation-parts.builder.ts` and the web app's two modules `fe/apps/web/src/modules/plugin-registry/index.ts` (server-safe) and `client.ts` (React, for client files only).
  There is no other entry and no allow-list beyond that constant: not a spec, not an app, not a second fe module. A root imports the registry only,
  never a business package.
- A spec's `jest.mock("@nivo-lite/plugin-registry", factory)` (also `doMock`, `unmock`) REPLACES the root's input and is no finding.
  `jest.requireActual` / `requireMock` of the registry, and any import or `require` of it, outside the roots is one: a spec reads the real
  installation through `realInstallation()` / `installationWith()` of the test root.
- `packages/agent-sdk/src/**` imports none of `@nivo-lite/blocks-core`, `@nivo-lite/nivo-web-core`, `@nivo-lite/plugin-registry`.

A relative path into `packages/<name>/` counts as the package. Imports are read with the TypeScript compiler API: a comment or a string
that only mentions a package is no import.

## Why

A dependency from the engine to business code makes the engine a place where business lives, and ties every engine change to a plugin
release. The direction is fixed: plugins depend on agent-sdk (the contract), the engine depends on agent-sdk, and the engine reads the
installed plugins from one value, `INSTALLED`, built at the composition root.

## How to fix a finding

- Generic code (names, ports, graph DSL, model catalogue, message contracts, time zone) belongs in `packages/agent-sdk/src/...` with a
  subpath export; blocks-core re-exports it from there.
- Business needed by the engine is reached through a contract in agent-sdk that the plugin implements and the engine reads from
  `INSTALLED` (`installed.policy.ts`). A spec reads `INSTALLED` through the same policy or builds its own installation with
  `defineInstallation` of agent-sdk, never the registry or a package by name.
- The front end reads the installation, the block renderers, the graph views, the fixtures and the words of the plugins from its two root modules
  (`fe/apps/web/src/modules/plugin-registry`, server-safe, re-exports `@nivo-lite/plugin-registry` and `/kit`; `.../client`, for client files only, re-exports `/client`); the generated entries
  (`packages/plugin-registry/src/kit/index.ts` and `src/client/kit.ts`, from `CORE_KIT` of `scripts/build-plugin-registry.mjs`, each entry tagged with its side) hold what the core package gives the app.
  Core contracts (message kinds and states, the template version) come from `@nivo-lite/agent-sdk`.
- Never add an allow-list entry; fix the import.

## Output

One line per finding `file:line  package`, then `engine imports: <n> finding(s) in <files> files (by folder: <folder> <count>, ...; by package: <package> <count>, ...)`
(folders: `be`, `fe/apps/<app>`, `fe/packages/<package>`, `packages/agent-sdk`). Exit 1 on any finding.

## Concept

`.starciwork/concepts/layers.md`.
