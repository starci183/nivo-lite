# The `packages` block to fold into ext/manifest.json when hfs 6.9.0 lands

## Why it is not in the manifest yet

The lane runs `@starci/hfs` 6.8.5, which reads ONLY `packages/<name>/slots.yaml` (R382) and ignores `ext/`. hfs 6.9.0 reads
`ext/manifest.json` `packages` and, for this one minor, still reads a package's `slots.yaml` when the manifest does not declare that package
(warning `HFS_PACKAGE_SLOTS_MOVED`); a package declared in BOTH places is `HFS_PACKAGE_SLOTS_INVALID`
(`runtime/scripts/hfs/rules/app-extension-findings.mts` `packageSlotFindings`). So:

- today (6.8.5): the four `slots.yaml` files are the only declaration that is read; a `packages` block in the manifest would be read by
  nobody, and the day 6.9.0 lands it would collide with the files that are still there. Safe form: leave the files, keep `packages` out.
- the day 6.9.0 lands: move the block below into the manifest and delete the four files IN THE SAME COMMIT (never one without the other).

`ext/support/validate-manifest.mjs` refuses a `packages` entry whose folder still holds its `slots.yaml`, so the half-move cannot land.

## The translation

Generated from the four files as they stand on 2026-11-13 (`packages/agent-sdk`, `packages/blocks-core`, `packages/nivo-web-core`,
`packages/plugin-registry`, all `schema: starci/package-slots@1`): the same keys (`closed`, `slots[]` with `id`, `path`, `coverage`) in
JSON, `schema` dropped (the manifest has its own), plus the new slot key `lint` (`be`, the default, or `fe`): `"lint": "fe"` on the slots that
are front-end code, by the harness hand-off's list (`src/workbench/**` but not `src/workbench/contract/**`, `src/public/**`, `src/client/**`):
`agent-sdk` `client` and `workbench`, `blocks-core` `client`, `plugin-registry` `client`. No package has a `src/public/` or a
`src/workbench/contract/` today. `blocks-core` `view` (`src/views/**`) stays `be`, as the canons judge it today. Each block was judged
by the 6.9.0 `judgePackageSlots` (no problem) and its `frontEndGlobs` give exactly those four globs. If a `slots.yaml` changes before the
fold, translate it again (same rule) instead of pasting this one.

Note: in 6.9.0 the canons do not yet READ `lint: fe` (PROJECT-LINT-3 known gap 2: the hard-coded `workbench/public/client` globs still
decide); the key is declared now so the cleanup branch can switch.

```json
  "packages": {
    "packages/agent-sdk": {
      "closed": true,
      "slots": [
        {"id": "barrel", "path": "src/index.ts"},
        {"id": "block", "path": "src/block/**"},
        {"id": "entity", "path": "src/entity/**"},
        {"id": "graph", "path": "src/graph/**"},
        {"id": "host", "path": "src/host/**"},
        {"id": "installation", "path": "src/installation/**"},
        {"id": "invoke", "path": "src/invoke/**"},
        {"id": "module", "path": "src/module/**"},
        {"id": "mutation", "path": "src/mutation/**"},
        {"id": "names", "path": "src/names/**"},
        {"id": "node", "path": "src/node/**"},
        {"id": "port", "path": "src/port/**"},
        {"id": "query", "path": "src/query/**"},
        {"id": "rights", "path": "src/rights/**"},
        {"id": "schema", "path": "src/schema/**"},
        {"id": "slot", "path": "src/slot/**"},
        {"id": "spec", "path": "src/spec/**"},
        {"id": "template", "path": "src/template/**"},
        {"id": "test-fixtures", "path": "src/tests/fixtures/**"},
        {"id": "client", "path": "src/client/**", "lint": "fe", "coverage": {"none": "renderers: presentation only; judged by the fe canon and Grammar lint (SHARED-TEST-1)"}},
        {"id": "workbench", "path": "src/workbench/**", "lint": "fe", "coverage": {"none": "front-end views of the workbench host; judged by the fe canon and Grammar lint (SHARED-TEST-1)"}}
      ]
    },
    "packages/blocks-core": {
      "closed": true,
      "slots": [
        {"id": "barrel", "path": "src/index.ts"},
        {"id": "bounds", "path": "src/bounds.ts"},
        {"id": "plugin", "path": "src/plugin.ts"},
        {"id": "json-schema", "path": "src/json.schema.ts"},
        {"id": "fixtures-barrel", "path": "src/fixtures.ts"},
        {"id": "grammar-tones", "path": "src/grammar-tones.d.ts", "coverage": {"none": "a type declaration: it augments the Grammar tone registry and holds no runtime code to run"}},
        {"id": "package-specs", "path": "src/*.spec.ts"},
        {"id": "block", "path": "src/blocks/**"},
        {"id": "entity", "path": "src/entities/**"},
        {"id": "fixture", "path": "src/fixtures/**"},
        {"id": "message", "path": "src/messages/**"},
        {"id": "node", "path": "src/nodes/**"},
        {"id": "row", "path": "src/rows/**"},
        {"id": "rule", "path": "src/rules/**"},
        {"id": "slot", "path": "src/slots/**"},
        {"id": "view", "path": "src/views/**"},
        {"id": "vocabulary", "path": "src/vocabulary/**"},
        {"id": "module-action", "path": "src/modules/<module>/actions/"},
        {"id": "module-read", "path": "src/modules/<module>/reads/"},
        {"id": "module-job", "path": "src/modules/<module>/jobs/"},
        {"id": "module-message", "path": "src/modules/<module>/messages/"},
        {"id": "module-fixture", "path": "src/modules/<module>/fixtures/"},
        {"id": "module-spec", "path": "src/modules/<module>/specs/"},
        {"id": "module-template", "path": "src/modules/<module>/template/"},
        {"id": "module-root", "path": "src/modules/*/*"},
        {"id": "modules", "path": "src/modules/*"},
        {"id": "client", "path": "src/client/**", "lint": "fe", "coverage": {"none": "renderers: presentation only; judged by the fe canon and Grammar lint (SHARED-TEST-1)"}}
      ]
    },
    "packages/nivo-web-core": {
      "closed": true,
      "slots": [
        {"id": "barrel", "path": "src/index.ts"},
        {"id": "plugin", "path": "src/plugin.ts"},
        {"id": "package-specs", "path": "src/*.spec.ts"},
        {"id": "contract", "path": "src/contracts/**"},
        {"id": "node", "path": "src/nodes/**"},
        {"id": "vocabulary", "path": "src/vocabulary/**"},
        {"id": "module-message", "path": "src/modules/<module>/messages/"},
        {"id": "module-template", "path": "src/modules/<module>/template/"},
        {"id": "module-root", "path": "src/modules/*/*"},
        {"id": "modules", "path": "src/modules/*"}
      ]
    },
    "packages/plugin-registry": {
      "closed": true,
      "slots": [
        {"id": "barrel", "path": "src/index.ts"},
        {"id": "installed", "path": "src/installed.ts"},
        {"id": "installed-spec", "path": "src/installed.spec.ts"},
        {"id": "client", "path": "src/client/**", "lint": "fe", "coverage": {"none": "renderers: the registry of the block renderers is presentation wiring; judged by the fe canon and Grammar lint (SHARED-TEST-1)"}}
      ]
    }
  }
```

## The exact steps, the day the lane takes hfs 6.9.0

1. Install hfs 6.9.0 with the canons it pairs with (`@starci/eslint-canon-be` 3.24.0, `@starci/eslint-canon-fe` 9.17.0, Grammar family
   0.38.2: their peer is `~6.9.0`), through the harness's install road (`starci app sync`), never by hand.
2. In ONE commit: paste the block above into `ext/manifest.json` as a top-level key after `checks` (it is valid JSON once placed between the
   manifest's braces), and delete `packages/agent-sdk/slots.yaml`, `packages/blocks-core/slots.yaml`, `packages/nivo-web-core/slots.yaml`,
   `packages/plugin-registry/slots.yaml`.
3. `npm run ext:all`: the validator now also runs the installed loader (`node_modules/@starci/hfs/runtime/scripts/lib/project-ext.mjs`) and
   must print `accepted: 7 rules … 5 checks, 4 packages`.
4. `starci app check --env local`: no `HFS_PACKAGE_SLOTS_MOVED`, no `HFS_PACKAGE_SLOTS_INVALID`, no `HFS_EXT_INVALID`; the `checks` step
   lists the five project checks; the lint gate reports the `project-ext/*` rules.
5. Delete this file in the same commit as step 2, or right after.

## Also red the day 6.9.0 lands (R103 `HFS_REPO_LOCAL_CHECK`, outside ext/; not moved by the ext rewrite)

hfs 6.9.0 refuses a check-named runnable file in `scripts/` or `tools/` and a package script that runs one
(`runtime/scripts/hfs/rules/repo-local-checks.mts`). In this lane that is:

- `scripts/tool-names-check.mjs`, and the root script `tool-names:check` that runs it: move the program into `ext/checks/tool-names.mjs`
  (replacing the thin wrapper; its `ROOT` then resolves two folders up), keep `--self-test` reachable through `node ext/checks/tool-names.mjs
  --self-test`, and point `tool-names:check` at `node ext/checks/tool-names.mjs` (a script that runs a declared check is allowed) or drop it.
- `scripts/di-ring-check.mjs` (not an ext check today): its owner moves it into `ext/checks/` and declares it, or deletes it.

`scripts/account-data-ddl.mjs`, `scripts/seeds-graphs.mjs` and `scripts/build-plugin-registry.mjs` are generators (no check word in the name)
and stay; their `--check` is reached through the ext wrappers.
