# Second brain ("Brain" in the product)

One shared memory per workspace; every agent reads it through its own view. Owners and managers decide what changes.

## Model

| Table                   | Holds                                                                                    | Rules                                                                                                                                                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brain_facts`           | What is true: subject + attribute + value, with source, trust, scope, validity, evidence | Exactly one `active` row per (subject, attribute). A new value supersedes the old (kept as history). Future-dated values are `scheduled` and take over on `valid_from` (`promoteDue`). Nothing is deleted: wrong facts are `rejected` or `expired`. |
| `brain_lessons`         | How an agent should work (per module, or shared when `module` is null)                   | Proposed, then approved; versioned. Only `active` lessons reach an agent.                                                                                                                                                                           |
| `brain_source_profiles` | How to read one data source (connection + entity): field meaning, type, format           | Proposed from samples, confirmed once. Builds on `connections.public_meta.config` (the data hub's own column map); never writes it.                                                                                                                 |
| `brain_eval_cases`      | Known-good answers kept as regression cases                                              | Every owner correction (decision `edited` / `rejected`) becomes a case.                                                                                                                                                                             |

**Trust by source** (`TRUST` in `src/lib/brain/shared.ts`): owner 95, manager 85, document 75, system 70, staff 60, customer 30, AI 20. Only owner and manager statements apply without review (`AUTO_APPLY_TRUST` 85). A new value keeps the scope, modules and kind of the fact it replaces unless told otherwise, so a staff correction never turns a public price internal.

**Views** (`visibleTo`): customer-facing agents (chatbot) see `public` facts only; internal agents see `public` + `internal`; `restricted` facts only reach the modules they name.

## Where agents get it

- `AGENTS.md` (OpenClaw sync, `buildAgentBundle`): the "facts in force" section (every fact in the agent's view, grouped by subject, budgeted) and the "approved lessons" section. Every brain change calls `enqueueWorkspaceSync`.
- Per turn (`buildAgentContext`): `recall` adds `BRAIN FACTS [F1..]` matching the question and, for internal agents, `DATA RECORDS [D1..]` from `data_records` on connections the agent holds a grant on. Numbers are quoted as stored, never summed from text. Citations carry layer `brain` / `data`.

## Self-learning (reviewed)

The model never changes itself; the brain does. `mineLessons` reads the owner's corrections of one agent (decisions `edited` / `rejected`, proposal before and after), keeps each as an eval case, and asks the model for patterns seen in at least two corrections. Each pattern becomes a **proposed** lesson citing its decisions. Owners approve in Brain > Review.

## Conflicts

`suggestResolution` (deterministic, no tokens) proposes one action with its reason:
schedule (future start date) · split (the new value names a situation: "weekend", "student", ...) · reject (much less trusted source: a customer's message, the AI's guess) · apply (as trusted or newer, or the current value unconfirmed for 120 days) · ask.

## UI (`/brain`)

| Tab     | Purpose                                                                                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map     | Health at a glance. Clusters = subject kinds, size = facts, colour = conflict / waiting / fine / not visible through the lens. Lens = "see it as" one agent. Not an embedding projection. Big kinds collapse into one bubble ("Customers (240)"). |
| Review  | The daily work: proposals (conflicts first) with the current value, evidence, NIVO's suggestion and one-press action; proposed lessons.                                                                                                           |
| Facts   | Search, add, new value, stop using; scheduled values show "From dd/mm".                                                                                                                                                                           |
| Lessons | Per agent; "Find lessons from my corrections"; add by hand; retire.                                                                                                                                                                               |

## Next

1. Source profiles UI (confirm field meanings per data hub connection) and extraction of facts from data hub rows and Office notes ("@nivo remember") as proposals.
2. Full-text / vector index over `data_records` (the data hub will switch `searchRecordsForAgent` to it).
3. Replay `brain_eval_cases` before applying a lesson; quality metrics per agent (edit rate, ask rate, citation rate).
4. Read back what OpenClaw agents write to their own memory as proposals.
