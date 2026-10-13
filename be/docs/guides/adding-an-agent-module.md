# Adding an agent module to NIVO

> Status at the lite cutover. This guide records the module mechanism as it runs today: one `module.json` per module under
> `fe/apps/web/resources/modules/<key>/`, a generator and seed scripts. The modules lane replaces the generated registry with a typed
> catalog in `be/src/modules/domain/modules` that the web reads through the api; the data model, the authority rules and the checklist
> below stay the same, only the paths in sections 1 to 3 and 8 change with it.

A module is data, not hard-coded. The module list, the setup steps (gates), the authority actions, the base knowledge and the labels are all read from one registry: `resources/modules/<key>/module.json`. Chatbot, Sales, Accounting and the seven newer modules (shifts, booking, video, inventory, loyalty, content, hiring) all go through it.

Standing conventions: everything is industry-neutral (a spa is only an example); the only AI voice is OpenClaw (`generateWithOpenClaw` and the background jobs); everything that reaches a customer or touches money goes through the authority gate (`work_items` / `decisions`); credentials are encrypted in `connection_secrets`; seed content lives in `resources/`; the UI follows the `ui/*` knowledge and plain language.

## 1. Data flow

```
resources/modules/<key>/module.json ──► scripts/gen-module-registry.mjs ──► src/lib/module-registry.generated.ts (gitignored)
        │                                   (postinstall, predev, prebuild,            │
        │                                    pretypecheck, prestart)                   ├─ src/lib/module-registry.ts   (moduleDef, listModules, isModuleKey, pick...)
        │                                                                              └─ ModuleKey, ActionKey (string unions)
        ├─► npm run seed:modules  ──► tables public.modules + public.authority_actions
        └─► resources/nivo-knowledge/<key>/*.md ──► npm run seed:knowledge ──► public.nivo_knowledge
```

- The generated file is not in git. After editing `module.json`, run `npm run gen:modules` (or `npm run typecheck`, `npm run dev`, `npm run build`: they run the generator themselves). `npm ci` runs it through `postinstall`.
- Client and server share one constant; nothing reads files at run time (the host has no `resources/` when it runs).
- The `modules` and `authority_actions` tables are referenced by `agents`, `module_installations`, `authority_rules`, `work_items`, `knowledge_sources`, `knowledge_chunks` and `automation_pipelines`. A new module needs NO migration to have a place: add `module.json`, then run `npm run seed:modules` on production (a release step, after `db push` and before the install button is enabled).

## 2. What a module lane creates and owns

Each lane touches only the paths below and never edits another lane's files.

| Path                                      | Purpose                                                                                                                                                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resources/modules/<key>/module.json`     | The module definition (section 3).                                                                                                                                                                                                                                    |
| `resources/nivo-knowledge/<key>/*.md`     | Base knowledge: playbook (`playbook`), authority limits (`authority`), setup checklist (`setup_checklist`), tone (`tone`), hand-off rules (`escalation`, optional). The file name is a globally unique slug, prefixed `<key>-`. Loaded with `npm run seed:knowledge`. |
| `src/features/module-<key>/**`            | All UI and code of the module: workbench, server actions, queries, the dictionary `src/i18n/dict/<key>.ts` if needed.                                                                                                                                                 |
| `src/lib/module-<key>-*.ts`               | Server code of the module (queries, logic), prefixed `module-<key>-`.                                                                                                                                                                                                 |
| `supabase/migrations/<range>_<key>_*.sql` | Migration of the module's own tables (section 5).                                                                                                                                                                                                                     |
| `engine/src/features/<key>-*/**`          | A job handler if the module runs long work (section 6).                                                                                                                                                                                                               |

Each lane also adds EXACTLY ONE line to each shared registry file below. They are kept separate so lanes never collide.

| Registry file                                | Line to add                                  | When                                                                                                                           |
| -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/features/module-workbench/registry.ts`  | `<workbenchKey>: Workbench<Key>,`            | When there is a work screen. Set `"workbench": "<workbenchKey>"` in `module.json`. Without one the module shows "In progress". |
| `src/features/module-settings/registry.ts`   | `<extrasKey>: <Key>SettingsExtras,`          | When the module has its own settings card. Set `"settings_extras": "<extrasKey>"`.                                             |
| `src/lib/module-performers.ts`               | `<action>: <performer>,` one line per action | When an action has a real effect behind the authority gate (section 4).                                                        |
| `src/lib/engine-sync.ts` (`REPLY_CONTRACTS`) | `<key>: <reply contract>,`                   | Only customer-facing modules (`audience: "customer"`) need a reply contract.                                                   |

A workbench is a server component without props, for example `src/features/module-shifts/index.tsx` with `export default async function WorkbenchShifts() {...}`. Import it in `module-workbench/registry.ts` and add one line to the `WORKBENCHES` map.

## 3. `module.json`

```jsonc
{
  "key": "shifts",                    // short ASCII, same as the folder name
  "order": 40,                        // display order
  "name": { "vi": "...", "en": "Shifts and schedules" },
  "short_name": { "vi": "...", "en": "Shifts AI" },          // department name in Authority and activity
  "description": { "vi": "...", "en": "..." },               // one paragraph on the card at /agents
  "points": { "vi": ["...", "...", "..."], "en": ["...", "...", "..."] },
  "purpose": "a shift-scheduling assistant that ...",        // English, one line, goes into the setup chat prompt
  "icon": "review",                   // a name from IconName in src/ui (the generator checks it)
  "glyph": "M4 6h16v14H4z...",        // SVG path for the agent avatar
  "mascot": "/images/promo/mascot-night.png",   // an existing image in public/
  "category": "operations",           // sales_customer | operations | finance | marketing | hr (see _categories.json)
  "status": "early",                  // stable | early (early shows an "Early" badge)
  "audience": "internal",             // customer: only public knowledge reaches OpenClaw; internal: both
  "included_with_workspace": false,
  "available": true,
  "knowledge_folder": "shifts",       // folder under resources/nivo-knowledge
  "workbench": null,                  // key in module-workbench/registry.ts, null = "In progress"
  "settings_extras": null,            // key in module-settings/registry.ts
  "requires": { "capabilities": ["staff_directory"], "connections": [] },   // describes conditions; shown and checked later
  "connection_providers": [],         // connection providers the agent can use (telegram, zalo_oa, sepay...)
  "default_operating_mode": "assist", // assist | autopilot
  "agent": { "name": "Shifts Agent", "handle": "shifts", "summary": {...}, "capabilities": {...}, "role": {...}, "instructions": {...} },
  "gates": [ { "key": "...", "label_vi": "...", "label_en": "...", "hint_vi": "...", "hint_en": "..." } ],   // every gate is required to apply the setup
  "authority_actions": [
    { "action": "approve_swap", "label": { "vi": "...", "en": "..." }, "mode": "auto", "limit_vnd": null,
      "required_fields": [], "amount_limit": false, "max_mode": "ask" /* optional: never done automatically */, "next": [] /* follow-up actions */ }
  ]
}
```

The generator validates (an error stops the build): the key equals the folder, `status`, `category`, `icon`, the mascot image exists, the knowledge folder exists, gate keys are unique, and action keys are unique across the whole registry (`^[a-z][a-z0-9_]{2,40}$`).

The i18n labels `dept_<key>`, `module_<key>` and `action_<action>` are generated from the registry; never add them by hand to `governance.ts` or `knowledge.ts`.

## 4. Authority: everything that leaves goes through the gate

- Each `authority_actions[]` entry is an action that can be granted. Default `mode`: `auto` (do it within policy), `ask` (ask the owner), `never`. The owner changes it on the Authority page; a module in `assist` mode always lowers `auto` to `ask`.
- `max_mode: "ask"` means never automatic (publishing a video or a post): the UI drops the "Do it automatically" button, and both the `evaluateGate` gate and `saveRuleCore` block it.
- `amount_limit: true` turns on the VND limit field; `limit_vnd` is the amount that may be done automatically BELOW the threshold.
- When a module is installed, the system adds the module's missing default rules to `authority_rules` (it never overwrites the owner's choices).
- To give an action a real effect, call `runWork` (src/lib/engine.ts) with your `action` and register a performer in `src/lib/module-performers.ts`: `prepare` (at most one AI call through OpenClaw) and `perform` (runs only after the gate allows it or a person approved). Without a performer the gate still decides and records `decisions`, and the work only records the decision.
- Never message a customer and never touch money outside `perform`.

## 5. Migrations

Each lane has its own number range so they never collide. Naming: `YYYYMMDDHHMMSS_<key>_<description>.sql`, new files only, never edit an old one.

| Lane            | Range                               |
| --------------- | ----------------------------------- |
| registry (done) | `20261006100000` - `20261006199999` |
| shifts          | `20261007100000` - `20261007199999` |
| booking         | `20261008100000` - `20261008199999` |
| video           | `20261009100000` - `20261009199999` |
| inventory       | `20261010100000` - `20261010199999` |
| loyalty         | `20261011100000` - `20261011199999` |
| content         | `20261012100000` - `20261012199999` |
| hiring          | `20261013100000` - `20261013199999` |

A module's own tables must have `workspace_id`, turn on RLS (read: `is_member`, write: `is_manager` or the service role), and be prefixed `<key>_`. Do not add CHECK constraints that pin module keys or actions; add a foreign key to `modules(key)` if needed.

## 6. Background work

Heavy or long work (rendering a video, scanning applications) runs as a background job whose kind is prefixed with the module: `<key>.<task>` (for example `video.render`). Add the handler as a feature under the job features of the back end and register it in the app composition (one line). Enqueue it through the job outbox like `chat.turn`. Every result comes back through a signed route under `/api/engine/*` and passes the authority gate like any other input; the worker never writes straight into a customer's channel.

AI text: only `generateWithOpenClaw` (src/lib/openclaw-generate.ts) or a background job. `src/lib/deepseek.ts` is not used for chat.

## 7. OpenClaw

Agent sync (`openclaw.sync_agent`) runs for every module in the registry: `AGENTS.md` holds the base rules (the module's knowledge folder and `core`), the approved context (gates read from the registry), the persona and the business knowledge (filtered by `audience`); `SOUL.md` takes its tone from the `tone` gate (a module should have one) and the `tone` knowledge. Installing a module queues a sync at once; the setup chat runs through `openclaw.generate` with the module's `purpose`.

## 8. Checklist for adding or finishing a module

1. Edit `resources/modules/<key>/module.json`, run `npm run gen:modules`.
2. Write the base knowledge in `resources/nivo-knowledge/<key>/`, run `npm run seed:knowledge`.
3. Run `npm run seed:modules` so `modules` and `authority_actions` hold your key and actions.
4. UI code in `src/features/module-<key>/**`, then one line in `module-workbench/registry.ts` (and `module-settings/registry.ts` if any).
5. Your migration in your own range; the performer in `module-performers.ts`.
6. `npm run typecheck` and `npm run build` must pass. The front end carries no tests.
7. Before pushing: apply the migrations (`supabase db push`) and run `npm run seed:modules`.
