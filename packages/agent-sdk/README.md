# @nivo-lite/agent-sdk

The one SDK every Nivo agent kind is built on. A module (built-in or, after review, third party) is a package on this SDK: its
**template**, its **node registrations** and its **workbench**. The app imports the module list and provides the host; it holds no
module code.

| subpath                             | side                 | owner            | holds                                                                                                                                                                                                                                  |
| ----------------------------------- | -------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./module`                          | React-free           | workbench lane   | `ModuleTemplate` (catalogue entry, agent, gates, authority actions, accepted commands), the platform vocabulary (`ModuleAudience`, `ModuleCapabilityRole`, `ModuleTriggerPreset`), `ModuleServer`, `moduleListProblems`, `templatesOf` |
| `./workbench/contract`              | React-free           | workbench lane   | slots (`DataSlot`, `mapSlot`, `slotOfRead`, `slotOfReads`), the workbench declaration, the host port types, the spec schema, `specProblems`, `specRegistryFrom`, `SDK_SPEC_BLOCKS`                                                     |
| `./workbench`                       | React (Grammar only) | workbench lane   | everything of `./workbench/contract`, plus `WorkbenchHostProvider` / `useWorkbenchHost`, the blocks, `SpecWorkbench`                                                                                                                   |
| `./node`, `./template`, `./testing` | React-free           | marketplace lane | node-kind and provider registry, the agent template package format (M0, M1), fakes                                                                                                                                                     |

## Code and data

The split is WordPress-like and it is the rule every subpath follows.

- **Code** lives in the build-time registry of packages: node kinds, SDK blocks, module blocks and components, execution logic. It is
  reviewed, versioned with the package and never stored in or loaded from the database.
- **Data** lives in the database: templates, installations, parameters, and **workbench specs**: a screen as a tree of registered
  blocks with bindings to the reads and actions registered modules expose, like a block layout in a post. A spec can recompose a
  workbench without a deploy; it can never add a behaviour, because every block, read and action it names must already be code in the
  registry (`specProblems` refuses anything else).

## What the existing workbenches share

Surveyed: the eleven workbench blocks of `fe/apps/web` (`components/blocks/*Workbench`: accounting, booking, chatbot, content, hiring,
inventory, lead gen, loyalty, sales, shifts, video), their hooks (`hooks/*Workbench`, `hooks/workbench`, `hooks/agentDashboard`), and
the back-end read models `domain/chatbot-workbench`, `domain/sales-workbench` (mappers of one board read per module).

**One shell, copied eleven times.** Every workbench draws the same frame, written again in each block:

1. _Overview top_: the waiting decisions (`WaitingRegion` through `SlotView`), a figures card (`FiguresStrip`; `FiguresRibbon` was the
   same `SurfaceCard kind="figures"` under a second name), the `Tabs` strip and a `role="tabpanel"` holding the chosen panel.
2. _Dashboard cards_: `Grid kind="cards" columns={3}` of done, connections and knowledge, each its own `SlotView` (`DashboardCards`,
   identical in all eleven).
3. _Explanation shape_: while `?why=` names a work item, `WorkbenchWhyFrame` with the waiting and done lists as `WorkbenchPaneRows`
   (`Explanation`, identical in all eleven).
4. The connected half is always `useAgentWorkbenchShell` (tabs from `?tab=`, the dashboard read, the why pane) plus one read per panel,
   every read folded to a `DataSlot` and drawn through `SlotView`.

**Panel patterns, by module.**

| pattern                                                                                                           | where                                                                                 | SDK answer                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| record list with search, filter, sort, "show more"                                                                | chatbot customers, inventory stock, lead gen rows, loyalty members, sales orders      | Grammar `SurfaceCard kind="list"` / `Section kind="list"` + `SearchField`/`FilterButtonGroup` (no wrapper needed); spec block `record-list`   |
| list with the chosen record beside it                                                                             | loyalty members, hiring candidate, inventory and accounting drawers                   | block `MasterDetail` (Grid `main-rail` + detail anchor), Grammar `Drawer`                                                                     |
| decisions waiting for a person                                                                                    | chatbot, sales (`WorkbenchWaitingList`), loyalty, inventory, accounting pending lists | blocks `WorkbenchWaitingList` + `WorkbenchDecisionRow` + `WorkbenchTraceLine`, `WaitingRegion`; spec block `waiting`                          |
| figures and meters                                                                                                | every overview; booking stats, content balance, shifts week stats                     | block `FiguresStrip`; spec blocks `figures` + `figure`                                                                                        |
| settings and setup sections (`Grid kind="form"`: booking 7, hiring 5, inventory 8, loyalty 11, shifts 7, video 2) | every module's settings                                                               | block `SettingsSection`; spec block `section`                                                                                                 |
| record facts                                                                                                      | booking detail, member panel, why pane                                                | Grammar `DescriptionList`; spec blocks `detail` + `fact`                                                                                      |
| pipeline board of lanes                                                                                           | sales, hiring                                                                         | **Grammar gap**: lanes need `Grid kind="lanes"` (today `LANE_CLASS_NAME`, `BOARD_CLASS_NAME` in app CSS)                                      |
| month calendar and agenda, week grid                                                                              | content calendar, hiring interviews, shifts week                                      | `Grid kind="week" / "week-summary"` exist; **Grammar gap**: the month grid with its phone agenda (`GRID_WRAP_CLASS_NAME`) and the shifts grid |
| conversation pane                                                                                                 | chatbot thread, sales conversations                                                   | Grammar `PaneGrid` + `MessageBubble`; **Grammar gap**: the side panel and thread layout classes                                               |
| step editor                                                                                                       | video editor, chatbot setup                                                           | Grammar `Stepper`; the video editor body is the escape hatch                                                                                  |

**Layout code that blocks composition.** 29 `classNames.ts` files sit under workbench-owned components (board lanes, calendar grid,
shifts grid, week bar, side panels, form stacks, preview cards). Each is either a missing Grammar API (listed above) or a stack the
Grammar already has (`flex flex-col gap-3` is `Stack gap="row"`, which the pilot used).

## The workbench API

### A module declares (`./workbench/contract`)

```ts
interface WorkbenchDeclaration {
  key: string // = template.workbench
  namespace: string // the module's message namespace
  views: [WorkbenchViewDefinition, ...WorkbenchViewDefinition[]] // id (?tab=), labelKey, permission?
  permissions: ReadonlyArray<string>
  operations: ReadonlyArray<string> // every host operation it runs: the host's allowlist for this module
  exposes?: { blocks; reads; actions } // what a stored spec may name
}
interface WorkbenchModule extends WorkbenchDeclaration {
  render:
    | { kind: "component"; Component: ComponentType<WorkbenchRouteProps> }
    | { kind: "spec"; document: WorkbenchSpecDocument } // a module's default layout as data
}
```

`workbenchProblems` refuses duplicate views, an undeclared view permission, an exposed read or action outside the module's operations
or of another module, and a default spec of another module; `defineWorkbench` throws on the first. `specRegistryFrom(declarations)`
assembles the spec registry from `SDK_SPEC_BLOCKS` and every declaration's exposures; a name defined twice throws, so a module can never
shadow an SDK block.

### The host provides (`WorkbenchHost`)

| port          | members                                                                                                                                        | in process                                                                                             | in an iframe sandbox                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `i18n`        | `useText(namespace)`, `useFormat()`, `useLocale()`, `useSlotWords()`                                                                           | next-intl                                                                                              | messages over the channel                        |
| `data`        | `useQuery(operation, variables)`, `useNamedQuery(name, variables)`, `useCommand(operation, refreshes)`, `useNamedCommand(name)`, `isForbidden` | SWR + the app's GraphQL client, keyed by workspace; the operation must be in the module's `operations` | the host runs the operation, the frame gets data |
| `navigation`  | `href(path)`, `useQueryValue(key)`, `setQueryValue(key, value)`                                                                                | next router                                                                                            | `postMessage`                                    |
| `permissions` | `useCan(permission)`, `useCanDecide(staffId)`                                                                                                  | the member session                                                                                     | same                                             |
| `feedback`    | `notify(tone, message)`                                                                                                                        | the toast module                                                                                       | same                                             |
| `shell`       | `useShell({ module, installationId, tabs, initialTab })` → tabs, why pane, dashboard regions, scope, workspace                                 | `useAgentWorkbenchShell`                                                                               | same                                             |

A module imports `react`, `@starci/grammar` and `@nivo-lite/agent-sdk` and nothing else at runtime: no SWR, no Apollo, no next-intl, no app
path. The same component then runs in process or behind an iframe host that implements the same ports.

### The blocks (`./workbench`)

All are compositions of `@starci/grammar/common` alone, with no class, colour or CSS.

| block                                                                 | from                                 | purpose                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `SlotView`                                                            | app `composites/SlotView`            | the one data-status recipe (loading as the ready tree, forbidden, error with retry, empty) |
| `FiguresStrip`                                                        | app `FiguresStrip` + `FiguresRibbon` | the figures card                                                                           |
| `WaitingRegion`, `DoneRegion`, `ConnectionsRegion`, `KnowledgeRegion` | app composites                       | the four dashboard regions                                                                 |
| `WorkbenchDashboardCards`                                             | new (the copied `DashboardCards`)    | done, connections, knowledge in one card grid                                              |
| `WorkbenchOverviewTop`                                                | app frame                            | waiting, figures, tabs, panel                                                              |
| `WorkbenchExplanation`                                                | new (the copied `Explanation`)       | the explanation shape                                                                      |
| `WorkbenchWhyFrame`, `WorkbenchWhy`, `WorkbenchPaneRows`              | app                                  | the why pane and its lists                                                                 |
| `WorkbenchWaitingList`, `WorkbenchDecisionRow`, `WorkbenchTraceLine`  | app                                  | decisions decided in place                                                                 |
| `SettingsSection`                                                     | loyalty `LoyaltySettingsSection`     | one titled settings card                                                                   |
| `MasterDetail`                                                        | loyalty members frame                | a list and the chosen record's detail                                                      |

### The escape hatch

A screen no block expresses (today: the video editor's step bodies and preview, the chatbot thread and composer, the pipeline boards and
calendar grids until their Grammar APIs land) is a **module component**: a React component inside the module package, under
`src/workbench/components/`, composed only of Grammar components and SDK blocks, reaching data only through the host. It is not an
exception: it is the same lint scope as every block (FE canon and the grammar lint over `packages/module-*/src/workbench/**`, no
`className`, no CSS file, no app import), and it can be registered as a module spec block (`exposes.blocks`) so specs place it by name.
A needed layout the Grammar lacks is a Grammar request, never CSS in the module.

## The declarative spec (DATA)

`nivo/workbench-spec@1`, typed by `WorkbenchSpecDocument`:

```json
{
  "schema": "nivo/workbench-spec@1",
  "module": "loyalty",
  "views": [
    {
      "id": "overview",
      "label": { "key": "tab_overview" },
      "root": {
        "id": "root",
        "block": "stack",
        "props": { "gap": "region" },
        "children": [
          { "id": "waiting", "block": "waiting" },
          {
            "id": "figures",
            "block": "figures",
            "props": { "label": { "key": "figuresLabel" } },
            "bind": { "data": { "read": "loyalty.figures", "path": "figures" } },
            "children": [
              { "id": "members", "block": "figure", "props": { "term": { "key": "members" }, "path": "members" } }
            ]
          },
          {
            "id": "list",
            "block": "record-list",
            "props": {
              "label": { "vi": "Khách thân", "en": "Regulars" },
              "empty": { "key": "membersEmpty" },
              "idPath": "id",
              "titlePath": "name",
              "badgePath": "tier"
            },
            "bind": { "rows": { "read": "loyalty.members", "path": "members" } }
          },
          { "id": "cards", "block": "dashboard-cards" }
        ]
      }
    }
  ]
}
```

- A text is a message key of the module's namespace or owner-written words in both product languages.
- A binding names a read or an action **the spec's own module exposes**; a read declares its shape (`record`, `list`, `value`) and the
  paths a binding may narrow to, so a list is never bound where one record is drawn.
- `specProblems(document, registry)` refuses: unknown schema, no view, duplicate view or node ids, depth over `SPEC_MAX_DEPTH` (8),
  unknown block, unknown / missing / mistyped prop, unknown / missing slot, a binding of the wrong kind, an unknown read or action, an
  unexposed path, another module's binding, a shape mismatch, and children under a leaf block. The back end runs it before saving and
  publishing a version (the contract subpath is React-free); the front end runs it again before drawing, against the same build-time
  `SPEC_REGISTRY` of `@nivo-lite/modules/manifest`.
- `SpecWorkbench` draws a published document: the shell, the tabs of its views, the chosen view's tree, SDK renderers for SDK blocks and
  the module's renderers (`moduleBlocks`) for its exposed blocks; a block the registry no longer holds draws nothing.
- A visual composer is a later step. The contract is ready for it: node ids are stable addresses, the registry gives the composer its
  palette (block props, slot kinds and shapes), and `specProblems` is its live validator.

### Persistence and versioning (proposal for the app)

Specs follow the graph model of M0/M1: immutable versions, a published pointer, provenance.

```sql
-- one spec per (workspace, installation) or one per creator template; the published pointer moves, versions never change
create table workbench_specs (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id),
  module_key text not null,
  installation_id uuid null references module_installations(id),   -- null: a creator's template spec
  template_id uuid null references agent_templates(id),              -- set when the spec belongs to a marketplace template
  published_version_id uuid null,                                    -- null: the module's own render draws
  created_at timestamptz not null default now(),
  unique (workspace_id, installation_id)
);
create table workbench_spec_versions (
  id uuid primary key,
  spec_id uuid not null references workbench_specs(id),
  version int not null,
  schema text not null,                -- 'nivo/workbench-spec@1'
  document jsonb not null,             -- WorkbenchSpecDocument, validated by specProblems on insert
  document_hash text not null,         -- canonical hash, as agent template versions
  registry_digest text not null,       -- digest of the SPEC_REGISTRY it was validated against
  source text not null,                -- 'owner' | 'template' | 'module-default' | 'update-merge'
  source_template_version_id uuid null references agent_template_versions(id),
  parent_version_id uuid null references workbench_spec_versions(id),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (spec_id, version)
);
```

- A marketplace template (M1 `AgentTemplatePackage`) carries spec documents as data; the installer writes version 1 with
  `source='template'` and leaves it unpublished, like the shadow graph, until the owner publishes.
- A template update offers the new spec version and merges per view (keep, take theirs, three-way by node id), as the graph merge does
  per branch.
- A registry change that removes a block or a read makes stored versions invalid: the host re-validates published versions at start
  (`registry_digest` changed) and falls back to the module's own render for an invalid one, reporting it, never drawing half a screen.
- Reads stay rights-checked: an exposed read runs a host operation of the module's allowlist under the viewer's own session, so a spec
  can never see more than the module's own screen sees (owner ruling on agent data rights: default deny, MCP only).

## Monorepo layout (end state)

```
packages/
  agent-sdk/                 @nivo-lite/agent-sdk        ./module ./node ./template ./testing ./workbench ./workbench/contract
  module-<name>/             @nivo-lite/module-<name>
    src/index.ts             the module key
    src/template/            ./template   ModuleServer: template + copy (vi.json, en.json) + node registrations   (React-free)
    src/manifest/            ./manifest   WorkbenchDeclaration: views, permissions, operations, exposes            (React-free)
    src/workbench/           ./workbench  pure views and module components, types                              (React, Grammar only)
  modules/                   @nivo-lite/modules          the one list
    src/template/            MODULE_SERVERS        (the back end reads nothing else)
    src/manifest/            MODULE_WORKBENCHES, SPEC_REGISTRY
```

- **Naming**: directory `packages/module-<key>`, package `@nivo-lite/module-<key>`, key = catalogue key = workbench key = message namespace.
  Constants: `<KEY>_TEMPLATE`, `<KEY>_SERVER`, `<KEY>_WORKBENCH`, `<KEY>_VIEW_IDS`; components `<Key><Thing>`, pure halves `<Key>…View`.
- **package.json**: `private`, no `"type"`, `exports` per subpath; the React-free subpaths point at `dist/<subpath>/index.{js,d.ts}`
  (CommonJS, `tsconfig.build.json`, module `node16`, for the back end), `./workbench` at `dist/esm/workbench/index.{js,d.ts}` (ES modules,
  `tsconfig.build.workbench.json`, for the front end, because `@starci/grammar` is ESM only); `build` runs both, both with
  `isolatedDeclarations`; `dependencies: { "@nivo-lite/agent-sdk": "*" }`; `peerDependencies: react, @starci/grammar` at the stack pins. A
  React-free file imports a Grammar type with `with { "resolution-mode": "import" }`.
- **Build and resolution**: root `workspaces` gains `packages/*` (done; the lockfile carries the three links), so `npm ci` links
  `node_modules/@nivo-lite/*` and the back end resolves the packages like any dependency: no tsconfig path and no jest alias (the jest preset
  admits none). turbo `build` depends on `^build`, so `agent-sdk` → `module-*` → `modules` build first; the back end's `typecheck`,
  `test` and `build:be` must run after that build (harness item 5). The web app reads the sources through its own tsconfig paths, which
  Next compiles.
- **Registry**: adding a module is one line in `packages/modules/src/template/index.ts` and one in `manifest/index.ts`. The app's back
  end builds `MODULE_CATALOG` from `templatesOf(MODULE_SERVERS)` plus the modules not yet moved; the front end reads
  `MODULE_WORKBENCHES` and pairs each key with its component.

## Pilot: Loyalty (stage 1)

Moved into `packages/module-loyalty`: the template and its 44 vi/en messages (out of `domain/modules/messages`), the workbench
declaration, the 25 pure Loyalty components (`frames`, `composites`, `branches`, `leaves`, and the pure halves of `LoyaltyWorkbench` and
`LoyaltyProgramSettings`) and the four Loyalty view-type files. Rebuilt onto the SDK: the two layout class files became `Stack` and
`MasterDetail`, `LoyaltySettingsSection` is the SDK's `SettingsSection`, the copied dashboard cards and explanation are the SDK's
blocks. Moved into the SDK from the app: the thirteen shared workbench components and the slot, row and dashboard types, which the
app's `modules/types` now re-exports. Routes, reads, copy and the catalogue order are unchanged.

Stays in the app for stage 2: the connected Loyalty hooks (`hooks/loyalty*`, `hooks/rhf/useLoyalty*`, `hooks/swr/*Loyalty*`), the
GraphQL documents, and the public pages (`PublicLoyaltyPage`, `LoyaltyCheckForm`). Stage 2 moves the hooks onto `useWorkbenchHost()`
and the documents into the package as `WorkbenchOperation`s; the app's `components/blocks/LoyaltyWorkbench` then disappears and the route
mounts `WorkbenchHostProvider` around the module's component. The `redeem_reward` intent frame stays in `customer-turns` until the
plugin registry merges frames from several manifests over one result.

## Migration guide: move one module

Follow it for one module per agent; the Loyalty commits on `feat/agent-sdk-workbench` are the worked example. `<key>` is the module key.

1. **Create the package.** Copy `packages/module-loyalty/{package.json,tsconfig.json,tsconfig.build.json}` to `packages/module-<key>/`,
   rename to `@nivo-lite/module-<key>`, write `src/index.ts` with `<KEY>_MODULE_KEY`.
2. **Template.** Move `be/src/modules/domain/modules/<key>.contracts.ts` to `src/template/<key>.template.ts` as
   `<KEY>_TEMPLATE: ModuleTemplate` and `<KEY>_SERVER: ModuleServer`. Move its `modulesCatalog.<key>.*` messages out of
   `domain/modules/messages/{vi,en}.json` into `src/template/messages/{vi,en}.json` (strip the prefix) and read them with the
   `copy.ts` helpers (copy Loyalty's). Replace `MODULE_AUDIENCES.<key>` by the literal. Delete the app's contracts file, add the server to
   `packages/modules/src/template/index.ts`, and remove the module from `APP_MODULES` in `modules.catalog.contracts.ts`.
3. **Spec the template.** Copy `loyalty.template.spec.ts`: copy helpers, both languages hold the same keys, `moduleListProblems` is
   empty, the catalogue fields (key, order, audience, workbench, settings) are what the app had.
4. **Declaration.** Write `src/manifest/declaration.ts`: views (the app's `<KEY>_TABS` ids with their `tab_*` keys), permissions, every
   GraphQL operation name the module's hooks run, and the reads (and later actions) a spec may bind. Point the app's `<KEY>_TABS` at
   `<KEY>_VIEW_IDS`. Add it to `packages/modules/src/manifest/index.ts`; spec it like `declaration.spec.ts`.
5. **Pure UI.** `git mv` every `components/{frames,composites,branches,leaves}/<Key>*/index.tsx` to
   `src/workbench/components/<Name>.tsx`, the pure halves (`blocks/<Key>Workbench/component.tsx` and any other module block's) to
   `<Key>…View.tsx`, and `modules/types/<key>-*.ts` to `src/workbench/types/`. Rewrite imports: `@/components/...` to `./<Name>`,
   `@/modules/types` to `../types`, shared types and blocks to `@nivo-lite/agent-sdk/workbench`.
6. **Grammar only.** Delete every `classNames.ts`: a stack is `Stack gap=<role>`, list-and-detail is `MasterDetail`, a settings card is
   `SettingsSection`; anything else is a Grammar gap to report (board lanes, month grid, thread layout), drawn meanwhile by the app's
   current component left in place. Replace the copied `DashboardCards` and `Explanation` by `WorkbenchDashboardCards` and
   `WorkbenchExplanation`. Give every exported component `: ReactNode`.
7. **App wiring.** In `fe/apps/web/src/modules/types/index.ts` re-export the moved types from `@nivo-lite/module-<key>/workbench`; the
   connected blocks import the package's views. Add the path `@nivo-lite/module-<key>/*` to `fe/apps/web/tsconfig.json` and the package to
   `packages/modules/package.json` dependencies, then `npm install --package-lock-only --ignore-scripts` (the lockfile alone, never
   through the shared node_modules). In a lane worktree whose `node_modules` is a junction, link locally for the checks: junctions
   `be/node_modules/@nivo-lite/<pkg>` and `packages/node_modules/@nivo-lite/<pkg>` to `packages/<pkg>` (both ignored by git), and build the
   packages (`npm run build` in each, in dependency order).
8. **Prove.** `tsc --noEmit` in `be/`, `fe/apps/web`, and every package; `tsc -p tsconfig.build.json` in each package (isolated
   declarations); the package specs at 100% per file; `npx starci app check --gate lint --json` with no new finding outside the
   expected harness items; the back-end build still emits `dist/apps/api/src/main.js`.
9. **Stage 2 (after Loyalty's stage 2 lands as the example):** move the connected hooks onto `useWorkbenchHost()`, the GraphQL
   documents into the package, and register `render: { kind: "component", Component }`.

## Harness changes required (not made here)

1. **Slot** `repo.shared-packages`: `packages/<pkg>/` at the app root, side-neutral, `tier: package`, required `package.json`,
   `src/index.ts`, `tsconfig.json`, `tests: unit-beside`. Today `packages/` matches no slot (`HFS_SLOT_UNDECLARED` for every file).
2. **Lint by subpath**: `packages/*/src/workbench/**` under the FE canon and the grammar lint (with the package tier: Grammar imports only,
   no `className`, no CSS, no app import); `packages/*/src/{module,template,manifest,node,testing}/**` and `packages/*/src/workbench/contract/**`
   under the BE canon plus a React-import ban. Today neither app ESLint config reaches `packages/` (files outside the base path are ignored),
   so the package code is not lint-checked by the gate.
3. **FE-PACKAGES-2 rewrite** (owner ruling 1): a workbench package draws only with Grammar components and SDK blocks; it holds no class,
   colour or CSS. The rule `monorepo-tier-belongs-to-its-side` / `package-shape` must accept such a package.
4. **Coverage scope** (owner ruling 2, BE-TEST-13 / R273): `packages/*/src/**/*.ts` logic at 100% per file (excluding `*.types.ts`,
   `index.ts`, `*.spec.ts`), a `packages` component in `codecov.yml`, and `be/packages/*/**` leaves the `ignore` list for module packages;
   the unit jest project gains `packages/` roots (here proven with a scratch config).
5. **Managed scripts and CI order**: the rendered `typecheck`, `test` and `build:be` scripts (and the CI jobs) build `./packages/*` with
   turbo before the back end runs, since the back end now imports the packages' `dist`; the rendered `lint` builds them too. The root
   `workspaces` entry `packages/*` must be part of the package-scripts render so `starci app sync` keeps it.
6. **Generator** `starci app add module <key>`: writes the package skeleton of the layout above, the two registry lines, the tsconfig
   paths and the spec files.
7. **Hooks in worktrees**: a lane worktree has `core.hooksPath=.husky/_` but no `.husky/_`, so commits run no hook. The worktree setup
   should run `husky` (or the harness should refuse a commit without the hook). Separately, `codecov.yml` and `.github/workflows/ci.yml`
   already drift from their render at the base commit 5077b8810, so `starci app sync` in the commit hook is red for every lane.

## Open questions

1. The marketplace lane places the SDK at `be/packages/agent-sdk`; this lane at `packages/agent-sdk`, because a package that holds both
   React (`./workbench`) and back-end code cannot sit in one side under hfs. Which location wins for the merge?
2. Should the platform vocabulary (`ModuleCapabilityRole` and the trigger presets) live in the SDK (as now, the app aliases it) or stay in
   the app with modules typed loosely and checked at load?
3. Permissions: loyalty's views are all open and `canManage` is decided per read by the back end. Should `WorkbenchViewDefinition.permission`
   map to the member grants (`member-grants`), and who maps `loyalty.manage` to roles?
4. Public pages of a module (`/l/[slug]`, the loyalty check form) are neither workbench nor template. A `./public` subpath with the same
   host contract?
5. `MODULE_AUDIENCES` in `domain/module-audiences` still names every module key; it should derive from the templates once every module
   has moved (owner ruling nivo-graph-core-generic).
