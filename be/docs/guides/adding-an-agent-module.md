# Adding an agent module to NIVO

A module is data, not hard-coded. The module list, the setup steps (gates), the authority actions, the base knowledge and the labels are all read from one typed catalogue in the back end; the web reads it through the GraphQL API. Chatbot, Lead generation, Sales, Accounting, Shifts, Booking, Inventory, Loyalty, Video, Content and Hiring all go through it.

Standing conventions: everything is industry-neutral (a spa is only an example); the only AI voice is OpenClaw (the `generate-with-agent` and `run-chat-turn` jobs); everything that reaches a customer or touches money goes through the authority gate (`work_items` / `decisions`); credentials are encrypted (`connection_secrets`); the UI follows plain language and the grammar renderers of `@starci/grammar`.

## 1. Data flow

```
be/src/modules/domain/modules/<key>.contracts.ts   (ModuleDefinition)
        │  registered in modules.catalog.contracts.ts (MODULE_CATALOG, display order)
        │
        ├─► cli seed-modules run ──► tables public.modules + public.authority_actions   (upserts, deletes nothing)
        ├─► be/src/modules/domain/nivo-knowledge/<key>-knowledge.templates.ts ──► NIVO base knowledge of the module (knowledgeFolder)
        └─► GraphQL (served from `be/src/features/api/modules`): catalogue, installations, setup state ──► fe hooks/swr ──► workbench page
```

- The catalogue is code: nothing reads files at run time. The copy of a module (name, description, points, gates, agent persona) is i18n content under the `modulesCatalog.<key>.*` keys of the back end message bundle, bound with `catalogText` / `catalogList` / `catalogCopy` (`be/src/modules/domain/modules/policies/catalog-copy.policy.ts`).
- The `modules` and `authority_actions` tables are referenced by `agents`, `module_installations`, `authority_rules`, `work_items`, `knowledge_sources`, `knowledge_chunks` and `automation_pipelines`. A new module needs NO migration to have a place: add the definition, then run `cli seed-modules run` on production (a release step, after the database migrations and before the install button is enabled).

## 2. The module definition

`ModuleDefinition` (`be/src/modules/domain/modules/modules.contracts.ts`) is the whole contract. The booking module (`be/src/modules/domain/modules/booking.contracts.ts`) is a complete example. The fields that matter:

| Field                                                                                   | Meaning                                                                                                                    |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `key`, `order`                                                                          | stable lowercase key and display order                                                                                     |
| `name`, `shortName`, `description`, `points`, `purpose`                                 | catalogue copy (bilingual) and one English line for the setup prompt                                                       |
| `category`, `status`, `audience`, `available`, `includedWithWorkspace`, `multiInstance` | where it appears, who its agent talks to, whether it can be added or comes with every workspace                            |
| `knowledgeFolder`                                                                       | the folder of the base knowledge templates (`<key>`)                                                                       |
| `workbench`, `settingsExtras`                                                           | the key of the module's workbench / extra settings page in the web app, or `null`                                          |
| `requires`, `connectionProviders`                                                       | capabilities and connections the workspace should have, and the providers the agent can use                                |
| `agent`                                                                                 | name, handle, persona, capabilities, role and instructions of the OpenClaw agent                                           |
| `gates`                                                                                 | the setup steps (a `tone` gate is advised: the agent's soul file takes its tone from it)                                   |
| `authorityActions`                                                                      | the authority actions that can be granted (section 4); `accepts` lists the commands other agents may ask the module to run |

## 3. What adding a module touches

1. `be/src/modules/domain/modules/<key>.contracts.ts` and one line in `be/src/modules/domain/modules/modules.catalog.contracts.ts`; the copy under `modulesCatalog.<key>.*` in the message bundle (both languages).
2. The base knowledge: `be/src/modules/domain/nivo-knowledge/<key>-knowledge.templates.ts` and its registration in `be/src/modules/domain/nivo-knowledge/nivo-knowledge.templates.ts`.
3. The GraphQL surface when the module has its own operations: a feature `be/src/features/api/<feature>/{application,transport/graphql}` (one resolver per action, one command or query bus call, no response envelope; copy an existing feature such as `features/api/modules`).
4. The web: a page `fe/apps/web/src/features/pages/<Key>WorkbenchPage/{index.tsx,component.tsx,classNames.ts}`, its hooks under `hooks/swr/api/graphql` and `hooks/<domain>`, and i18n messages in the `workbench<Key>` namespace of `modules/i18n/messages/{en,vi}.json` (keep both catalogs in lockstep).
5. A migration only when the module has its own tables (section 5).
6. Background work and the OpenClaw agent (sections 6 and 7).

## 4. Authority

- Each `authorityActions[]` entry is an action that can be granted. Default `mode`: `auto` (do it within policy), `ask` (ask the owner), `never`. The owner changes it on the Authority page; a module in `assist` mode always lowers `auto` to `ask`.
- `maxMode: "ask"` means never automatic (publishing a video or a post): the UI drops the "Do it automatically" button, and the gate blocks it.
- `amountLimit: true` turns on the VND limit field; the stored limit is the amount that may be done automatically BELOW the threshold.
- When a module is installed, the system adds the module's missing default rules to `authority_rules` (it never overwrites the owner's choices).
- An action gets a real effect through a job step under `be/src/features/jobs/<job>` that runs only after the gate allows it or a person approved. Without one the gate still decides and records `decisions`.
- Never message a customer and never touch money outside that step.

## 5. Migrations

Forward-only, in `supabase/migrations/`, with a fresh timestamp after the newest migration. A module's own tables must have `workspace_id`, turn on RLS with `<table>_<role>_<action>` policies (read: `is_member`, write: `is_manager` or the `app_be` role), carry the grants of `app_be` in the same file and be prefixed `<key>_`. Do not add CHECK constraints that pin module keys or actions; add a foreign key to `modules(key)` if needed. After a migration regenerate the types with `npm run contract:emit`.

## 6. Background work

Heavy or long work (rendering a video, scanning applications) runs as a job: a queue under `be/src/modules/queues/<queue>` (contracts, typed producer, module), a processor with steps under `be/src/features/jobs/<job>` and, for a recurring tick, a scheduler registered in the scheduler list of `be/apps/api/src/compose/schedulers.ts`. Enqueue it from the application handler in the same transaction as the business row. Design and operation: `be/docs/guides/jobs.md`. A result never writes straight into a customer's channel: it passes the authority gate like any other input.

AI text: only through the OpenClaw jobs (`generate-with-agent`, `run-chat-turn`).

## 7. OpenClaw

Agent sync (`sync-agents` job, every 5 minutes and on install) runs for every installed module: the agent rules file holds the base rules (the module's knowledge folder and `core`), the approved context (gates), the persona and the business knowledge (filtered by `audience`); the soul file takes its tone from the `tone` gate and the `tone` knowledge. Installing a module queues a sync at once; the setup chat runs through the `run-setup-turn` job with the module's `purpose`. `OPENCLAW_MANAGE_AGENTS=true` lets the api create the agents itself.

## 8. Checklist for adding or finishing a module

1. Definition, catalogue line, copy and knowledge templates in the back end.
2. `cd be && npx jest --selectProjects unit modules/domain/modules` (the catalogue specs cover every definition).
3. GraphQL operations if any, then `npm run contract:emit` (commit `be/contracts/api/schema.graphql`) and `npm run codegen` in the web workspace.
4. The workbench page, hooks and messages in the web app. The front end carries no tests.
5. `npm run typecheck`, `npm run lint`, `npm run build:be`, `npm run build:fe`.
6. Release: apply the migrations, then `cli seed-modules run`.
