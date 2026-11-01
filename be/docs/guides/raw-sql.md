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
    consume statement, and the customer-session setup statements.
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
> `src/modules/platform/database/database.client.ts`, which names only a function that `ruleParams.be.dbFunctions` or hfs.json
> `sides.be.dbFunctions` lists with a reason:
>
> - a function of a migration, schema-qualified (`public.job_claim`);
> - an extension function, schema-qualified;
> - a pg built-in of the canon's list, bare.
>
> `src/modules/platform/database/database.client.ts` alone composes SQL text: the call statement and `LISTEN`, from parts its validator checked.
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
  LISTEN statements in `src/modules/platform/database/database.client.ts`, which splice only the name parts and parameter list its own
  validator checked."
- **R36** (full): unchanged.
- **R98 / R99**: unchanged; cited by the world clause.
- **R335**: unchanged (`advisoryXactLock` and `job_tick_claim` stay).
- **R259**: unchanged; no migration ships.
- The 2026 world raw-SQL ruling is **narrowed**: the world keeps raw SQL for probes only.

### 2.3 Decisions, with reasons

| Question                                                                | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why                                                                                             |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Plain CRUD                                                              | Entities, everywhere, the world included. jsonb filters use `createQueryBuilder(Entity, "o").where("o.payload->>'x' = :x", { x })`. Row locks use `findOne(E, { where, lock: { mode: "pessimistic_write" } })`. Time-relative writes use a JS `Date`.                                                                                                                                                                                                       | `starci app db drift` checks entities. Entities give typed rows, unit doubles and builders.     |
| An app function from the world                                          | `callDbFunction` (`public.http_rate_limit_consume`, `public.http_rate_limit_cleanup`, `public.be_auth_set_avatar`, …).                                                                                                                                                                                                                                                                                                                                      | One way to call a function.                                                                     |
| World probes                                                            | Stay raw: `has_*_privilege`, `pg_policies`, `pg_class`, `pg_proc`, `cron.job`, `storage.*`, `GRANT/SET LOCAL ROLE`, `LOCK TABLE`, `DO` blocks, `pgmq.q_*` tables, `SELECT 1 / 0`. They stay where they are (inline `sql` or the world's `*.sql.ts`), keeping the `sql` tag and `$n` parameters.                                                                                                                                                             | Owner: no test-only functions in the main database.                                             |
| Tables without an entity (`auth.*`, `storage.*`, `cron.*`, pgmq tables) | World raw is allowed. `auth.users` cleanup stays raw; the avatar write uses `public.be_auth_set_avatar` if it writes `nivo_avatar_url`.                                                                                                                                                                                                                                                                                                                     | App code reaches `auth.*` only through its SECURITY DEFINER doors; these tables are not mapped. |
| `advisoryXactLock(m, key)`                                              | `callDbFunction(m, "hashtextextended", [key, 0])`, then `callDbFunction(m, "pg_advisory_xact_lock", [hash])`. API unchanged.                                                                                                                                                                                                                                                                                                                                | No literal outside the composer. One extra round trip inside the caller's transaction.          |
| `notify(m, ch, payload)`                                                | `callDbFunction(m, "pg_notify", [ch, payload])`.                                                                                                                                                                                                                                                                                                                                                                                                            | Same.                                                                                           |
| `listenOn`                                                              | Stays composed (branded channel, R68).                                                                                                                                                                                                                                                                                                                                                                                                                      | LISTEN takes no parameter.                                                                      |
| Rate-limit store                                                        | `callDbFunction(m, "public.http_rate_limit_consume", [key, windowMs, limit])`. The rate-limit store's SQL and row-mapper files are deleted.                                                                                                                                                                                                                                                                                                                 | A function call.                                                                                |
| Customer sessions                                                       | Pass-through files `src/modules/platform/database/customer-sessions.client.ts` and `src/modules/platform/database/postgres-session.client.ts`, listed in hfs.json `sqlPassThrough`. The outside session's setup is a plain string const in that file (the MySQL session execution-time statement, with a parameter), never a template. Prefer the pg connection option `options: "-c default_transaction_read_only=on"`. The session's SQL file is deleted. | Our functions do not exist in a customer's database.                                            |
| Seed runner                                                             | Canon pass-through.                                                                                                                                                                                                                                                                                                                                                                                                                                         | The text is the tracked seed file.                                                              |
| The `sql` tag                                                           | Stays exported. Its only lite users are the world. Lint refuses importing it outside `src/tests/world`.                                                                                                                                                                                                                                                                                                                                                     | The world probes need it.                                                                       |
| `*.sql.ts`                                                              | Only under `src/tests/world`. The 3 domain misnomers are renamed (`src/modules/domain/bookings/booking-effects.rows.ts`, `src/modules/domain/work-items/work-items.rows.ts`, `src/modules/domain/identity/persistence/auth-doors.port.ts`).                                                                                                                                                                                                                 | One style outside the world.                                                                    |
| Pass-through unit specs                                                 | Exempt (`session.query("select 1")` on a fake).                                                                                                                                                                                                                                                                                                                                                                                                             | No database is reached.                                                                         |

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

`@starci/eslint-canon-be` `D:/.claude/packages/eslint-canon-be/src/no-raw-sql.ts` (R334, lite):

- **`query`**: `.query(` is refused everywhere except:
  - `src/tests/world/**`;
  - `src/modules/platform/database/database.client.ts` with the R68-branded templates;
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
  `sides.be.sqlPassThrough` is accepted by `D:/.claude/packages/hfs/runtime/scripts/hfs/manifest-shape.mts` and merged in `D:/.claude/packages/eslint-canon-be/src/lib/hfs-view.ts` like `dbFunctions`.
- **Slots**: lite `be.persistence` keeps forbidding the SQL and row-mapper files (`*.sql.ts`, `*.rows.ts`). `be.tests.world` allows `<name>.sql.ts`.
- **Canon template** (`D:/.claude/packages/hfs/templates/be/skeleton-lite/src/modules/platform/database/database.client.ts`):
  `advisoryXactLock` and `notify` become `callDbFunction` calls of the canon built-ins (already listed). The spec follows.
- **Contexts**:
  - `D:/.claude/contexts/hfs/rules.yaml`: R334 and R68.
  - `D:/.claude/contexts/code/be/persistence.md`: BE-PERSISTENCE-4 lite paragraph.
  - `D:/.claude/contexts/code/be/test.md`: the world clause.
  - `D:/.claude/contexts/decisions/rulings.yaml`: new ruling `no-raw-sql-one-style`, quoting §1 and narrowing the world ruling.
  - `D:/.claude/contexts/hfs/slots.yaml`.
  - `D:/.claude/contexts/project/lite.md`.
  - Generated anatomy and index files, via their generator.
- **Tests**: RuleTester valid and invalid cases for each message:
  - a domain `.query(` refused;
  - a `platform/database` literal `.query(` refused;
  - the branded composer accepted;
  - a pass-through file listed and not listed;
  - a template in a pass-through file refused;
  - a pass-through spec exempt;
  - a domain `*.sql.ts` refused, a world `*.sql.ts` accepted;
  - an `sql` import refused outside the world;
  - `worldCallHelper` and `worldTableWrite` each fire and do not fire (`has_table_privilege(...)`, `LOCK TABLE`,
    `UPDATE pgmq.q_x`).
- **Bumps**, following commit 8a107ce2's shape:
  - eslint-canon-be: next minor;
  - @starci/hfs: next minor;
  - the lint cohort packages that bundle the catalog: patch;
  - the cli prerelease;
  - the package CHANGELOGs and the root CHANGELOG;
  - `D:/.claude/contexts/stack/pins.yaml` and every canon pins file, then the harness bundles build.

## 4. Lanes

The four lanes (H harness, P platform/database, W1 and W2 test world) built this change against the law above; their
briefs are retired and the commits carry the history. Residue after the pins bump is assigned by `npx starci app check`.
