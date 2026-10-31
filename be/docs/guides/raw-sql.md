# No raw SQL in app TypeScript: entities or `callDbFunction` (R334 amended)

Design of 2026-10-31 for the StarCi harness (`D:/.claude`) and nivo-lite. It was designed by one Opus agent and is built by
four Sonnet lanes (H harness, P platform/database, W1 and W2 test world).

## 0. The owner's question, answered

> "Pick one style, I thought we were not writing raw SQL!!! Or do we?"

Honest answer, read on 2026-10-31 at nivo HEAD 0a4a40ddf:

- **App domain and feature code holds no raw SQL text.** It reads and writes through entities and calls database
  functions through `callDbFunction`.
- **Raw SQL text does exist** in two places the old R334 allowed:
  - the test world `src/tests/world`: 22 files, about 80 `.query(` calls, 17 files with inline `sql` templates, plus 5
    `*.sql.ts` files;
  - a few `platform/database` files: the `advisoryXactLock` and `notify` literals, the rate-limit store's
    `RATE_LIMIT_CONSUME`, and the customer-session setup statements.
- The three domain files named `*.sql.ts` (`booking-effects`, `work-items`, `identity-auth`) hold query-builder fragments
  and `callDbFunction` wrappers, not raw statements.

This change removes raw SQL from everything except the test world's probes. In the world, plain CRUD moves to entities
and app function calls move to `callDbFunction`.

## 1. Owner rulings (verbatim)

- "I mean there must be no table without SQL, there has to be an entity for each": every table has an entity.
- "Ah, so the code ships the function and just does not call it through an SQL query, then keep the db functions": database functions stay, called as
  functions.
- "I mean drop raw SQL, write plain functions and call them by calling the db function" / "Pick one style": one style. No raw SQL in
  TS: entities, or a function called through `callDbFunction`.
- "Well, the test world may write queries, adding them to the main db is not great": the test world may keep raw queries for
  what entities and functions cannot express. Test-only functions do **not** go into the main database.
- "Delete any code nobody uses": unused things are deleted. That is the separate drop lane. All 141
  `sides.be.dbFunctions` entries are named in code today, so there is nothing to hand over.

No migration ships in this change (no new function, no drop).

## 2. The law (locked)

### 2.1 R334 `BE_PERSISTENCE_NO_RAW_SQL`: new law text

> Lite TypeScript holds no SQL text, outside the test world. A table is read and written through its TypeORM entity on an
> EntityManager (domain code the injected one; specs, builders, fixtures and the test world the world's
> `world.db.<connection>`): `find`, `save`, `update`, `delete`, `upsert`, a pessimistic `lock` option,
> `createQueryBuilder(Entity, "alias")` with named parameters; never a table-name builder or a Repository. Every table a
> migration creates has an entity. Anything else is a database function, called through `callDbFunction` of
> `platform/database/database.client.ts`, which names only a function that `ruleParams.be.dbFunctions` or hfs.json
> `sides.be.dbFunctions` lists with a reason:
>
> - a function of a migration, schema-qualified (`public.job_claim`);
> - an extension function, schema-qualified;
> - a pg built-in of the canon's list, bare.
>
> `database.client.ts` alone composes SQL text: the call statement and `LISTEN`, from parts its validator checked.
> `advisoryXactLock` and `notify` are `callDbFunction` calls of built-ins there. The only other `.query(` outside the
> world is the pass-through of a file that `ruleParams.be.sqlPassThrough` or hfs.json `sides.be.sqlPassThrough` lists
> with a reason; its text is not the app's own (the tracked seed, a customer data-source read, an outside session's
> setup).
>
> The test world `src/tests/world` may hold raw SQL, as `sql`-tagged text with numbered `$n` parameters, only for what
> neither an entity nor a listed function expresses: a privilege or row-level-security probe, catalog, cron or trigger
> introspection, a pgmq queue table, a lock or failure probe. In the world too, plain CRUD on an application table goes
> through its entity, an application function goes through `callDbFunction`, and seeded rows come from builders (R98).
> No `sql` template, `*.sql.ts` or other `.query(` exists anywhere else.

### 2.2 Touched laws

- **R68**: "SQL text carries no runtime substitution; values are numbered parameters. The one exception is R334's call and
  LISTEN statements in `platform/database/database.client.ts`, which splice only the name parts and parameter list its own
  validator checked."
- **R36** (full): unchanged.
- **R98 / R99**: unchanged; cited by the world clause.
- **R335**: unchanged (`advisoryXactLock` and `job_tick_claim` stay).
- **R259**: unchanged; no migration ships.
- The 2026 world raw-SQL ruling is **narrowed**: the world keeps raw SQL for probes only.

### 2.3 Decisions, with reasons

| Question                                                                | Decision                                                                                                                                                                                                                                                                                                                                                                                                      | Why                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Plain CRUD                                                              | Entities, everywhere, the world included. jsonb filters use `createQueryBuilder(Entity, "o").where("o.payload->>'x' = :x", { x })`. Row locks use `findOne(E, { where, lock: { mode: "pessimistic_write" } })`. Time-relative writes use a JS `Date`.                                                                                                                                                         | `starci app db drift` checks entities. Entities give typed rows, unit doubles and builders.     |
| An app function from the world                                          | `callDbFunction` (`public.http_rate_limit_consume`, `public.http_rate_limit_cleanup`, `public.be_auth_set_avatar`, …).                                                                                                                                                                                                                                                                                        | One way to call a function.                                                                     |
| World probes                                                            | Stay raw: `has_*_privilege`, `pg_policies`, `pg_class`, `pg_proc`, `cron.job`, `storage.*`, `GRANT/SET LOCAL ROLE`, `LOCK TABLE`, `DO` blocks, `pgmq.q_*` tables, `SELECT 1 / 0`. They stay where they are (inline `sql` or the world's `*.sql.ts`), keeping the `sql` tag and `$n` parameters.                                                                                                               | Owner: no test-only functions in the main database.                                             |
| Tables without an entity (`auth.*`, `storage.*`, `cron.*`, pgmq tables) | World raw is allowed. `auth.users` cleanup stays raw; the avatar write uses `public.be_auth_set_avatar` if it writes `nivo_avatar_url`.                                                                                                                                                                                                                                                                       | App code reaches `auth.*` only through its SECURITY DEFINER doors; these tables are not mapped. |
| `advisoryXactLock(m, key)`                                              | `callDbFunction(m, "hashtextextended", [key, 0])`, then `callDbFunction(m, "pg_advisory_xact_lock", [hash])`. API unchanged.                                                                                                                                                                                                                                                                                  | No literal outside the composer. One extra round trip inside the caller's transaction.          |
| `notify(m, ch, payload)`                                                | `callDbFunction(m, "pg_notify", [ch, payload])`.                                                                                                                                                                                                                                                                                                                                                              | Same.                                                                                           |
| `listenOn`                                                              | Stays composed (branded channel, R68).                                                                                                                                                                                                                                                                                                                                                                        | LISTEN takes no parameter.                                                                      |
| Rate-limit store                                                        | `callDbFunction(m, "public.http_rate_limit_consume", [key, windowMs, limit])`. `persistence/rate-limit.sql.ts` and `.rows.ts` are deleted.                                                                                                                                                                                                                                                                    | A function call.                                                                                |
| Customer sessions                                                       | Pass-through files `customer-sessions.client.ts` and `postgres-session.client.ts`, listed in hfs.json `sqlPassThrough`. The outside session's setup is a plain string const in that file (MySQL `SET SESSION MAX_EXECUTION_TIME = ?` with a parameter), never a template. Prefer the pg connection option `options: "-c default_transaction_read_only=on"`. `persistence/postgres-session.sql.ts` is deleted. | Our functions do not exist in a customer's database.                                            |
| Seed runner                                                             | Canon pass-through.                                                                                                                                                                                                                                                                                                                                                                                           | The text is the tracked seed file.                                                              |
| The `sql` tag                                                           | Stays exported. Its only lite users are the world. Lint refuses importing it outside `src/tests/world`.                                                                                                                                                                                                                                                                                                       | The world probes need it.                                                                       |
| `*.sql.ts`                                                              | Only under `src/tests/world`. The 3 domain misnomers are renamed (`booking-effects.columns.ts`, `work-items.columns.ts`, `identity/persistence/auth-doors.ts`).                                                                                                                                                                                                                                               | One style outside the world.                                                                    |
| Pass-through unit specs                                                 | Exempt (`session.query("select 1")` on a fake).                                                                                                                                                                                                                                                                                                                                                               | No database is reached.                                                                         |

### 2.4 Critique, and the mitigations

- **SQL injection.** Outside the world no TS text exists. The composer validates and quotes name parts and passes values
  as `$n`. World text is the `sql` tag (no value substitution, R68) with `$n` parameters.
- **Drift.** CRUD moves onto drift-checked entities. World probes run in their integration specs on every run, so a
  catalog change fails loudly.
- **Testability.** Unit specs mock `callDbFunction` or the manager. World probes are themselves tests.
- **Review.** App SQL lives in migrations. World raw is limited to probe kinds a reviewer can name.
- **What lint cannot see.** A world `SELECT` on an app table that should be an entity read. The lint flags world writes
  to app tables and world statements that only call a listed function. Reads are judged in review.

## 3. Lint design (harness)

`@starci/eslint-canon-be` `src/no-raw-sql.ts` (R334, lite):

- **`query`**: `.query(` is refused everywhere except:
  - `src/tests/world/**`;
  - `platform/database/database.client.ts` with the R68-branded templates;
  - a file listed in `sqlPassThrough`, when the first argument is not a template literal or `+` expression;
  - a `*.spec.ts` beside a listed pass-through file.

  `platform/database` loses its blanket exemption.

- **`template`**: a `sql` tagged template outside `src/tests/world`.
- **`sqlFile`**: a `*.sql.ts` outside `src/tests/world` (reported on Program).
- **`sqlTagImport`**: an import of `sql`, `ident`, `SqlText` or `SqlIdent` outside `src/tests/world` and the tag's own
  module.
- **World heuristics** (on a `sql` template's text inside `src/tests/world`):
  - **`worldCallHelper`**: the text matches `^\s*SELECT\s+(\*\s+FROM\s+)?<listed fn>\s*\(.*\)\s*(AS\s+\w+)?\s*;?\s*$`
    (case-insensitive), so it must be `callDbFunction`;
  - **`worldTableWrite`**: `^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(public|be_access)\.`, so it must go through
    the entity or the builder.
- **`builder`, `unlisted`**: unchanged.
- `ruleParams.be.sqlPassThrough: [{file, reason}]` in slots.yaml (canon: the seed runner). hfs.json
  `sides.be.sqlPassThrough` is accepted by `manifest-shape.mts` and merged in `lib/hfs-view.ts` like `dbFunctions`.
- **Slots**: lite `be.persistence` keeps forbidding `.sql.ts` and `.rows.ts`. `be.tests.world` allows `<name>.sql.ts`.
- **Canon template** (`packages/hfs/templates/be/skeleton-lite/src/modules/platform/database/database.client.ts`):
  `advisoryXactLock` and `notify` become `callDbFunction` calls of the canon built-ins (already listed). The spec follows.
- **Contexts**:
  - `rules.yaml`: R334 and R68.
  - `persistence.md`: BE-PERSISTENCE-4 lite paragraph.
  - `test.md`: the world clause.
  - `rulings.yaml`: new ruling `no-raw-sql-one-style`, quoting §1 and narrowing the world ruling.
  - `slots.yaml`.
  - `lite.md`.
  - Generated anatomy and index files, via their generator.
- **Tests**: RuleTester valid and invalid cases for each message:
  - a domain `.query(` refused;
  - a `platform/database` literal `.query(` refused;
  - the branded composer accepted;
  - a pass-through file listed and not listed;
  - a template in a pass-through file refused;
  - a pass-through spec exempt;
  - a domain `.sql.ts` refused, a world `.sql.ts` accepted;
  - an `sql` import refused outside the world;
  - `worldCallHelper` and `worldTableWrite` each fire and do not fire (`has_table_privilege(...)`, `LOCK TABLE`,
    `UPDATE pgmq.q_x`).
- **Bumps**, following commit 8a107ce2's shape:
  - eslint-canon-be: next minor;
  - @starci/hfs: next minor;
  - the lint cohort packages that bundle the catalog: patch;
  - the cli prerelease;
  - the package CHANGELOGs and the root CHANGELOG;
  - `contexts/stack/pins.yaml`, every `canon-pins.yaml`, then `npm run bundles`.

## 4. Lanes and ordering

| Lane | Owns                                                | Starts | Commits                                                |
| ---- | --------------------------------------------------- | ------ | ------------------------------------------------------ |
| H    | harness pkg worktree                                | now    | its pkg branch, no push                                |
| P    | `platform/database`, hfs.json, the 3 domain renames | now    | step 1 (hfs.json) first                                |
| W1   | world proof family                                  | now    | any time                                               |
| W2   | world queue, rate-limit and event-bus family        | now    | after P's step 1 (it calls `public.http_rate_limit_*`) |

The nivo lanes code against this law before the lint is published, using the greps in their briefs. After H's packages
are published and pinned in nivo (an owner step), `npx starci app check` assigns any residue to the owning lane.

## 5. Hard rules (every brief copies these)

```
- No eslint-disable, ts-ignore, `as` casts, --no-verify, coverage ignores.
- In nivo never git add -A / commit -a / stash / reset / checkout / restore / rebase / push.
- Commit through a temporary index:
    export GIT_INDEX_FILE="$(mktemp -u)"; git read-tree HEAD; git add -- <files>
    MSG="$(mktemp -u)"; printf '%s\n' "<subject>" "" "<body>" "" "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" > "$MSG"
    git commit -F "$MSG"; rm -f "$GIT_INDEX_FILE" "$MSG"; unset GIT_INDEX_FILE; git reset -q -- <files>
  For a shared file holding other lanes' hunks apply only your own patch with `git apply --cached`.
- Commit trailer: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- Never open *.enc*, secrets.env, *.env.
- Never start or stop the local api (18787) or web (3100); never start, stop or reset the local db container.
- Migrations forward-only; this change adds none. Any schema experiment runs on a copy (createdb nivo_x_copy;
  pg_dump --schema-only --no-owner postgres | psql -d nivo_x_copy; apply; check; dropdb), and applying locally is
  docker exec -i nivo-local-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres --single-transaction < file.
- Harness flow: pkg branch worktree, CHANGELOG + bump, canon-pins.yaml + `npm run bundles`, gates green, no push.
- D: is nearly full: keep temp output small and delete it.
- Do not ask the owner; when blocked, write the blocker in your report and finish the rest.
```

## 6. Briefs (verbatim)

### Brief H: harness law, lint, template

```
You are lane H of D:/starci-lanes/nivo-lite/be/docs/guides/raw-sql.md (read §0–§3 and §5). Work only in the StarCi
harness D:/.claude. Do not ask the owner.

Branch: `git -C D:/.claude branch --sort=-committerdate 'pkg/claude-*'`; use the worktree
D:/.claude/.claude/worktrees/pkg-claude-world-raw-sql and `git merge --ff-only <newest pkg/claude-* branch>`; if ff is
impossible, create a worktree on a new branch pkg/claude-no-raw-sql from <newest>. Never push; touch no other worktree.

Own: packages/eslint-canon-be/src/no-raw-sql.ts (+ spec), src/lib/hfs-view.ts, src/query-safety.ts (R68 text only),
src/index.ts if registration changes; packages/hfs: runtime/scripts/hfs/manifest-shape.mts, rule-params-shape.mts (and
their generated outputs via the build), templates/be/skeleton-lite/src/modules/platform/database/database.client.ts
(+ spec); contexts/hfs/rules.yaml (R334, R68), contexts/hfs/slots.yaml (ruleParams.be.sqlPassThrough with the seed
runner; be.tests.world allows <name>.sql.ts), contexts/code/be/persistence.md BE-PERSISTENCE-4, contexts/code/be/test.md,
contexts/decisions/rulings.yaml (ruling no-raw-sql-one-style quoting §1; narrow the world raw-SQL ruling),
contexts/project/lite.md; CHANGELOGs, versions + locks, contexts/stack/pins.yaml, every canon-pins.yaml, root CHANGELOG,
cli version.

Do §3 exactly: messages query, template, sqlFile, sqlTagImport, worldCallHelper, worldTableWrite; builder and unlisted
kept; platform/database's blanket exemption removed; the world keeps raw SQL; sqlPassThrough (ruleParams + hfs.json key);
canon database.client.ts: advisoryXactLock = callDbFunction hashtextextended(key, 0) then pg_advisory_xact_lock(hash),
notify = callDbFunction pg_notify; listenOn and the call template unchanged. Lite only; full's R36 untouched. RuleTester
cases per §3 "Tests". Regenerate the anatomy/index files with their generator; never hand-edit them.

Checks: packages/eslint-canon-be `npm run typecheck && npm test && npm run build`; packages/hfs
`npm run typecheck && npm test && npm run bundles && npm run bundles:check`; cli `npm run typecheck && npm test && npm run lint`.
Green before each commit; commits with `git add -- <files>` in the worktree: lint, hfs + template, contexts, bumps.

Hard rules:
- No eslint-disable, ts-ignore, `as` casts, --no-verify, coverage ignores.
- Commit trailer: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- Never open *.enc*, secrets.env, *.env.
- Never start or stop the local api (18787) or web (3100).
- Harness flow: pkg branch worktree, CHANGELOG + bump, canon-pins.yaml + `npm run bundles`, gates green, no push.
- D: is nearly full: keep temp output small and delete it.
Report: branch, hashes, versions, any red gate.
```

### Brief P: nivo platform/database, hfs.json, domain renames

```
You are lane P of D:/starci-lanes/nivo-lite/be/docs/guides/raw-sql.md (read §0–§2, §4, §5). Repo
D:/starci-lanes/nivo-lite (main; other lanes' work is in the tree: touch only your files). Do not ask the owner.

Own: hfs.json (sides.be.dbFunctions, sides.be.sqlPassThrough);
be/src/modules/platform/database/{database.client.ts, database.client.spec.ts, index.ts (your hunks only),
customer-sessions.client.ts (+ spec), postgres-session.client.ts (+ spec), postgres-rate-limit-store.client.ts (+ spec),
persistence/rate-limit.sql.ts, persistence/rate-limit.rows.ts, persistence/postgres-session.sql.ts};
domain/bookings/booking-effects.sql.ts → booking-effects.columns.ts (+ importers booking-effects.service.ts,
booking-notices.service.ts); domain/work-items/work-items.sql.ts → work-items.columns.ts (+ work-items.service.ts);
domain/identity/persistence/identity-auth.sql.ts → identity/persistence/auth-doors.ts (+ importers accounts,
authenticator, password-reset, sessions, signup services; password-reset and sessions hold other lanes' hunks:
git apply --cached). If `npx starci app check --staged` refuses a new name, use the name it suggests and report it.

Steps:
1. FIRST COMMIT (W2 waits on it): hfs.json sides.be.dbFunctions gains
   {name:"public.http_rate_limit_consume", reason:"the rate-limit store and the world's rate-limit proof: the atomic counter in database time"}
   {name:"public.http_rate_limit_cleanup", reason:"the world's rate-limit proof: the expired-window sweep"}
   (verify both exist: docker exec nivo-local-db psql -U postgres -d postgres -Atc "select to_regproc('public.http_rate_limit_cleanup')"). Commit alone.
2. database.client.ts: advisoryXactLock = callDbFunction(manager, "hashtextextended", [key, 0]) then
   callDbFunction(manager, "pg_advisory_xact_lock", [hash]) (read the hash column with a typeof check, no cast);
   notify = callDbFunction(manager, "pg_notify", [channel, payload]). callDbFunction, listenOn and the validator are
   otherwise unchanged; no literal `.query(` remains. Spec at 100%. Run one existing integration spec that takes the
   lock against the local db.
3. Rate-limit store → callDbFunction(m, "public.http_rate_limit_consume", [key, windowMs, limit]); read the
   `http_rate_limit_consume` column with a typeof check; delete rate-limit.sql.ts/.rows.ts; spec 100%.
4. Customer sessions: postgres-session uses the pg connection option `options: "-c default_transaction_read_only=on"` if
   its spec can prove it, otherwise a string const in postgres-session.client.ts; delete persistence/postgres-session.sql.ts.
   MySQL: MYSQL_READ_ONLY and `SET SESSION MAX_EXECUTION_TIME = ?` (run with [target.queryMs]) as string consts in
   customer-sessions.client.ts, no template. hfs.json sides.be.sqlPassThrough:
   [{file:"src/modules/platform/database/customer-sessions.client.ts",reason:"a customer data-source read the data-sources policy validated, and the outside session's setup"},
    {file:"src/modules/platform/database/postgres-session.client.ts",reason:"a customer PostgreSQL read the data-sources policy validated, and the outside session's setup"}]
   If the installed @starci/hfs rejects the key, leave it out and report it (it lands after the pin bump).
5. Domain renames (git mv, then commit both paths through the temp index).
Keep the `sql` export of platform/database (the world uses it).

Self-check: `git grep -nE "\.query[<(]" -- be/src/modules be/src/features be/apps ':!*.spec.ts'` shows only
database.client.ts's two templates and the pass-through files; `git grep -n "sql\`" -- be/src/modules be/src/features`
is empty; `git ls-files 'be/src/modules/*.sql.ts'` shows only platform/database/database.sql.ts (the tag module).
Checks per commit: `npx tsc -p be/tsconfig.json --noEmit`; `npx eslint <files>`;
`cd be && npx jest --selectProjects unit <specs> --coverage --collectCoverageFrom=<touched logic files>` at 100%;
`npx starci app check --staged`.

Hard rules:
- No eslint-disable, ts-ignore, `as` casts, --no-verify, coverage ignores.
- In nivo never git add -A / commit -a / stash / reset / checkout / restore / rebase / push.
- Commit through a temporary index:
    export GIT_INDEX_FILE="$(mktemp -u)"; git read-tree HEAD; git add -- <files>
    MSG="$(mktemp -u)"; printf '%s\n' "<subject>" "" "<body>" "" "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" > "$MSG"
    git commit -F "$MSG"; rm -f "$GIT_INDEX_FILE" "$MSG"; unset GIT_INDEX_FILE; git reset -q -- <files>
  For a shared file holding other lanes' hunks apply only your own patch with `git apply --cached`.
- Commit trailer: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- Never open *.enc*, secrets.env, *.env.
- Never start or stop the local api (18787) or web (3100); never start, stop or reset the local db container.
- Migrations forward-only; this lane adds none (test any schema experiment on a copy: createdb nivo_x_copy;
  pg_dump --schema-only --no-owner postgres | psql -d nivo_x_copy; apply; check; dropdb).
- D: is nearly full: keep temp output small and delete it.
Report: hashes, files, whether sqlPassThrough landed, anything left.
```

### Brief W1: test world, proof family (CRUD → entities, functions → callDbFunction)

```
You are lane W1 of D:/starci-lanes/nivo-lite/be/docs/guides/raw-sql.md (read §0–§2 and §5). Repo D:/starci-lanes/nivo-lite.
Do not ask the owner.

Own (be/src/tests/world/ only): avatars-database.service.ts, backend-role-proof.service.ts, backend-role.sql.ts,
chat-markers-database.service.ts, cron-proof.service.ts, delivery-jobs-proof.service.ts, delivery-jobs.sql.ts,
inbox-database.service.ts, proof-accounts.service.ts, proof-database.service.ts, proof.sql.ts,
telegram-delivery-proof.service.ts, telegram-delivery.sql.ts, zalo-delivery-proof.service.ts, zalo-delivery.sql.ts.
New builder files in be/src/tests/fixtures/builders/ only for an area with no builder; never edit an existing builder,
db/migrations or hfs.json.

Change only these two kinds of statement:
- Plain CRUD on an application table that has an entity (job_outbox, meta_inbox, jobs, …) goes through the entity on
  world.db.<c>: find/findOne/delete/update; jsonb filters with createQueryBuilder(Entity, "o").where("o.payload->>'deliveryId' = :id", { id });
  jsonb_build_object results built in TS from the entity fields; `now() - interval` / `sent_at = now()` writes as a JS
  Date. A `.sql.ts` constant that becomes unused is deleted; a `.sql.ts` left empty is deleted.
- A statement that only calls an application function goes through callDbFunction (it must be listed in hfs.json;
  proof-accounts' avatar update uses public.be_auth_set_avatar if its migration body writes nivo_avatar_url, otherwise
  it stays raw and you report it).
Leave raw (sql tag, $n): privilege/RLS probes (has_*_privilege, GRANT/SET LOCAL ROLE, storage.objects insert as a role),
pg_policies / pg_class / storage.buckets / cron.job reads, the cron DO block, LOCK TABLE, SELECT 1 / 0, auth.users cleanup.
Keep every exported helper's name, parameters and return type, so specs do not change; where that is impossible, stop for
that helper and report it.

Self-check: `grep -nE "(INSERT INTO|UPDATE|DELETE FROM) +(public|be_access)\." <your files>` is empty, except a
statement you report; no `SELECT public.<fn>(` statement remains.
Checks per commit: `npx tsc -p be/src/tests/tsconfig.json --noEmit`; `npx eslint <your files>`; the integration specs
importing your services (grep -rl "<service stem>" be/src/tests/integration):
`cd be && npx jest --selectProjects integration <specs>` against the running local db; `npx starci app check --staged`.
Commit in 2–3 slices.

Hard rules:
- No eslint-disable, ts-ignore, `as` casts, --no-verify, coverage ignores.
- In nivo never git add -A / commit -a / stash / reset / checkout / restore / rebase / push.
- Commit through a temporary index:
    export GIT_INDEX_FILE="$(mktemp -u)"; git read-tree HEAD; git add -- <files>
    MSG="$(mktemp -u)"; printf '%s\n' "<subject>" "" "<body>" "" "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" > "$MSG"
    git commit -F "$MSG"; rm -f "$GIT_INDEX_FILE" "$MSG"; unset GIT_INDEX_FILE; git reset -q -- <files>
  For a shared file holding other lanes' hunks apply only your own patch with `git apply --cached`.
- Commit trailer: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- Never open *.enc*, secrets.env, *.env.
- Never start or stop the local api (18787) or web (3100); never start, stop or reset the local db container.
- Migrations forward-only; this lane writes none.
- D: is nearly full: keep temp output small and delete it.
Report: hashes, per file which statements moved to entities or callDbFunction and which stayed raw (with the probe kind).
```

### Brief W2: test world, queue, rate-limit and event-bus family (CRUD → entities, functions → callDbFunction)

```
You are lane W2 of D:/starci-lanes/nivo-lite/be/docs/guides/raw-sql.md (read §0–§2 and §5). Repo D:/starci-lanes/nivo-lite.
Do not ask the owner. Code now; commit only after lane P's first commit (hfs.json lists public.http_rate_limit_consume
and public.http_rate_limit_cleanup: `git log -2 -- hfs.json`, grep hfs.json).

Own (be/src/tests/world/ only): event-bus-proof.service.ts, public-api-database.service.ts,
queue-cutover-database.service.ts, queue-reconciliation-proof.service.ts, rate-limit-database.service.ts,
redis-proof.service.ts, renewal-to-cash-database.service.ts. New builder files in be/src/tests/fixtures/builders/ only
for an area with no builder; never edit an existing builder, db/migrations or hfs.json.

Change only these two kinds of statement:
- Plain CRUD on an application table that has an entity (job_outbox, jobs, knowledge_sources, http_security) goes
  through the entity on world.db.<c>: find/delete/update; jsonb filters with createQueryBuilder(Entity, "o").where(...named params);
  `SELECT ... FOR UPDATE` as findOne(E, { where, lock: { mode: "pessimistic_write" } }) inside the helper's transaction;
  `now() - interval` / `statement_timestamp()` writes as a JS Date; the http_security seed INSERT goes through the area
  builder (new builder file if none). http_security's entity may still be another lane's uncommitted file: if it is not
  at HEAD when you commit, leave those statements raw and report them.
- `SELECT public.http_rate_limit_cleanup()` and `SELECT public.http_rate_limit_consume(...)` become callDbFunction
  (the result column is the function name).
Leave raw (sql tag, $n): has_*_privilege probes, GRANT/REVOKE/SET LOCAL ROLE, pgmq.q_* / a_* table reads and updates,
pgmq.meta / pgmq.list_queues() / query_to_xml counts, the pgmq purge DO block, pg_proc / to_regprocedure probes.
Keep every exported helper's name, parameters and return type, so specs do not change; where that is impossible, stop for
that helper and report it.

Self-check: `grep -nE "(INSERT INTO|UPDATE|DELETE FROM) +(public|be_access)\." <your files>` is empty, except a
statement you report; no `SELECT public.<fn>(` statement remains.
Checks per commit: `npx tsc -p be/src/tests/tsconfig.json --noEmit`; `npx eslint <your files>`; the integration specs
importing your services (grep -rl "<service stem>" be/src/tests/integration):
`cd be && npx jest --selectProjects integration <specs>` against the running local db; `npx starci app check --staged`.
Commit in 2–3 slices.

Hard rules:
- No eslint-disable, ts-ignore, `as` casts, --no-verify, coverage ignores.
- In nivo never git add -A / commit -a / stash / reset / checkout / restore / rebase / push.
- Commit through a temporary index:
    export GIT_INDEX_FILE="$(mktemp -u)"; git read-tree HEAD; git add -- <files>
    MSG="$(mktemp -u)"; printf '%s\n' "<subject>" "" "<body>" "" "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" > "$MSG"
    git commit -F "$MSG"; rm -f "$GIT_INDEX_FILE" "$MSG"; unset GIT_INDEX_FILE; git reset -q -- <files>
  For a shared file holding other lanes' hunks apply only your own patch with `git apply --cached`.
- Commit trailer: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- Never open *.enc*, secrets.env, *.env.
- Never start or stop the local api (18787) or web (3100); never start, stop or reset the local db container.
- Migrations forward-only; this lane writes none.
- D: is nearly full: keep temp output small and delete it.
Report: hashes, per file which statements moved to entities or callDbFunction and which stayed raw (with the probe kind).
```
