# Cutover: from the engine and Next route handlers to the api

This is the runbook for the day `lite/convert` becomes `main`. Until then production keeps deploying `main` (the engine and the Next route handlers) and nothing in the
conversion branch deploys by itself: the deploy workflows (`api-deploy.yml`, `edge-deploy.yml`, `web-deploy.yml`, `db-deploy.yml`) have no push trigger and run by hand only.

The cutover scripts live next to the integrator's notes in `D:/starci-tmp/nivo-lite-lanes/cutover/` (they are not in this repository; `READY.md` there is the dry-run report and agrees with this page). Every mutating script is a dry run unless it gets `--execute` AND the environment holds `NIVO_CUTOVER_ARMED=1`; the owner scripts (`owner/o*.mjs`) refuse to run inside an agent session. A short Vietnamese checklist of the owner-only steps is in `D:/starci-tmp/nivo-lite-lanes/CUTOVER-OWNER.md`.

## What lite/convert is now

- **The be is the single API.** One Nest app (`be/apps/api`) serves GraphQL at `/graphql` (contract `be/contracts/api/schema.graphql`), the REST webhooks and OAuth callbacks (`/api/...`), the public v1 API (`/api/v1/...`), the n8n callbacks (`/api/n8n/...`), the OpenClaw tool bridge (`/agent-tools`, internal), and runs the pgmq jobs and the sagas (schedulers: automation tick, shifts tick, agents sync, decisions drain, content tick, connection health, zalo refresh, data sync). `be/apps/cli` is the operator CLI (`migrate run`, `seed-media upload`, `seed-modules run`, `jobs ...`).
- **The fe calls the be through Apollo** (`fe/apps/web/src/modules/api/graphql`: auth and no-auth clients, the Supabase access token as the bearer, SWR hooks). The browser keeps Supabase for auth only. There are no Server Actions and no Next route handlers except `/health/live` and the auth callback. The REST controllers that duplicated GraphQL were deleted; REST stays for public v1, provider webhooks and OAuth callbacks, the n8n callbacks and the agent tools.
- **The migration history is one baseline.** `supabase/migrations/` holds `20261013142504_lite-baseline.sql`, `20261013142505_lite-baseline-standard.sql` and the forward migration `20261020110000_drop-engine-schema.sql` (retires the dead `engine_*` schema and the legacy pg_cron ticks). **The cutover push applies only the baseline pair; the drop migration is held back and applied by `09-post-cutover.mjs` 48 hours after a green smoke test (or when the owner says the old app is gone), because the old app needs the engine tables and a rollback would be impossible after it.** The 117 older migrations are in `supabase/migrations/_archive/`.
- **Secret custody** is `.starcistacks/production/secrets/<slug>.enc` (sops + age). The age identity is `SOPS_AGE_KEY` in the StarCi runtime `.claude/secret.env` (the owner backs it up). Deploys decrypt in the job with `SOPS_AGE_KEY` (a protected GitHub environment secret) through `deploy/materialize.mjs` and ship one file per key; the containers read `<NAME>_FILE`. No dotenv blob lives in GitHub.

## Hosts: nivo.vn (web) and api.nivo.vn (api)

The zone `nivo.vn` is at **Tino** (`ns1.tino.vn`, `ns2.tino.vn`). `nivo.vn` and `www.nivo.vn` already point at `103.142.27.9` (the VPS). **`api.nivo.vn` needs an A record `api.nivo.vn  A  103.142.27.9` added by the owner in the Tino panel BEFORE the cutover** (manual; nothing scripts DNS). `app-vps.`, `engine.` and `n8n.nivo.vn` do not resolve and are optional: no required config names them.

- `PUBLIC_API_URL=https://api.nivo.vn`, `NEXT_PUBLIC_API_URL=https://api.nivo.vn`, `NEXT_PUBLIC_DEVELOPER_API_URL=https://api.nivo.vn`. The api allows the browser origins `https://nivo.vn` and `https://www.nivo.vn` (`HTTP_SECURITY_ALLOWED_ORIGINS`).
- The edge (`deploy/edge/dynamic/routes.yml`) serves `api.nivo.vn` (automatic Let's Encrypt certificate) and routes it to the api. It ALSO keeps sending `/api/**`, `/graphql` and `/healthz` of `nivo.vn` and `www.nivo.vn` to the api (priority 100), so the per-connection webhooks customers configured with the old `https://nivo.vn/api/...` URLs keep working; `/graphql` on `nivo.vn` is a compatibility route. Everything else on `nivo.vn` goes to the web container (`/health/live` stays the web's).
- n8n is private (127.0.0.1 on the VPS, reached by SSH tunnel; the api calls it as `http://n8n:5678`); its `n8n.` router is a commented optional entry.
- **Before the cutover, add the new provider URIs** (adding them does not break the old ones; keep the old ones too): Meta app > Facebook Login > Valid OAuth Redirect URIs `https://api.nivo.vn/api/connections/meta/callback`; Meta app > Webhooks `https://api.nivo.vn/api/connections/meta/webhook` (same verify token); Google Cloud OAuth client > Authorized redirect URIs `https://api.nivo.vn/api/connections/google/callback`; SePay platform webhook `https://api.nivo.vn/api/sepay/webhook`. Per-connection webhooks (Telegram, Zalo, Casso, payOS, SePay feed) may stay on the old `nivo.vn` URLs; re-saving a connection registers the new host.
- ES256: production signs with an ECC P-256 key already (legacy HS256 kept as the previous key); the api verifies against the JWKS.

What changes in production:

| Before                                                                           | After                                                                                                                             |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `engine` container in OpenClaw's network namespace (port 8787), built on the VPS | `api` container (`be/apps/api`) in the same place and on the same port, image built on the GitHub runner                          |
| webhooks, OAuth callbacks and `/api/*` served by Next route handlers             | the same public paths served by the api; the edge sends `api.nivo.vn` and every `/api/` path of `nivo.vn` and `www.nivo.vn` to it |
| the browser talks to Supabase and to Next server actions                         | the browser talks to Supabase for auth and to `https://api.nivo.vn/graphql` with the user's access token                          |
| the service role in Next and in the engine                                       | the service role only in the api (Auth and Storage admin); database access as the least-privilege role `app_be`                   |
| secrets in `secrets.env`, pushed as `*_ENV` blobs                                | secrets in `.starcistacks/production/secrets/*.enc`, materialized per key at deploy time                                          |
| Netlify as a hot fallback                                                        | retired (turn its auto publishing off; its last good deploy stays for a DNS rollback)                                             |

## Order and why

The scripts below run: preflight, merge, database, owner secrets steps, platform admins, then deploy **api, then edge, then web** back to back (15 to 20 minutes). The edge sends `/api/` paths to the api at 8787: with the api first, the old Next handlers keep answering the webhooks until the edge flips them, and after the flip the api answers. The new web goes last. `PRIMARY_DB_URL` and the other sealed names must exist before the api deploy (the api refuses to start without them). Notation: **C** = the integrator runs it (a dry run until the owner says go), **O** = the owner runs it. `C=D:/starci-tmp/nivo-lite-lanes/cutover`.

## 0. Before (days ahead, owner)

1. Back up `secret.env` (it holds `SOPS_AGE_KEY`; losing it loses every sealed secret).
2. Database backup: enable Supabase PITR or take a `pg_dump` right before step 4 of the day.
3. Netlify: Site configuration > Build & deploy > turn **Auto publishing** off (do not delete the site).
   3b. DNS (Tino panel): add `api.nivo.vn  A  103.142.27.9` and check `nslookup api.nivo.vn 1.1.1.1`. Add the new OAuth / webhook URIs of the "Hosts" section in the Meta, Google and SePay consoles.
4. Supabase Dashboard > Authentication > URL Configuration: Site URL `https://nivo.vn`; Redirect URLs `https://nivo.vn/**`, `https://www.nivo.vn/**`, `http://localhost:3000/**`, `http://127.0.0.1:3000/**`. Keep the Google provider's callback `https://<ref>.supabase.co/auth/v1/callback`.
5. GitHub environment `production`: add the secret `SOPS_AGE_KEY` and protect the environment with required reviewers. Keep `VPS_SSH_KEY` and `VPS_KNOWN_HOSTS` (secrets) and the variables `VPS_HOST`, `VPS_USER`. The variables `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_DEVELOPER_API_URL` are optional (they default to `https://api.nivo.vn`). The old `API_ENV`, `ENGINE_ENV`, `WEB_ENV` and `WEB_NEXT_PUBLIC_*` secrets are not used by the new workflows, but the OLD workflows run from the tag for a rollback still read them: keep them until the cutover is accepted, then delete them.
6. Check the sealed names (the lists below) and re-seal what is wrong with `starci app secret set production <slug>`. Open items: `OPENCLAW_TOOL_SECRET` (agent tool bridge), the Meta trio if Meta connections are wanted, `SEPAY_WEBHOOK_API_KEY` and `SEPAY_ACCOUNT_NAME` (look like placeholders), `N8N_SIGNING_SECRET` (must equal what the n8n workflows sign with), and the obsolete keys listed in `.starcistacks/production/README.md`.
7. Commit the sealed-file changes on `lite/convert`.

## The day

| #   | Who | Command                                                                                                            | What it does                                                                                                                                       |
| --- | --- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | C   | `node $C/01-preflight.mjs`                                                                                         | read-only: tools, key, refs, sealed files, gh, supabase CLI, JWKS, DNS, env gaps                                                                   |
| 2   | O   | `source $C/owner/load-age-key.sh` ; `export ADMIN_DB_URL='<owner session-pooler string from Dashboard > Connect>'` | one shell for steps 3 to 9 (never paste these in chat)                                                                                             |
| 3   | C   | `node $C/02-merge-main.mjs`, then on the owner's word `NIVO_CUTOVER_ARMED=1 node $C/02-merge-main.mjs --execute`   | tags `pre-lite-cutover` (rollback point) and fast-forwards `main` to `lite/convert` (non-force)                                                    |
| 4   | C   | `node $C/03-db-migrate.mjs --dry-run`, then `--execute`                                                            | section "Database" below, idempotent; needs `ADMIN_DB_URL`                                                                                         |
| 5   | O   | `node $C/owner/o1-set-app-be-password.mjs`                                                                         | sets the `app_be` password from `app-be-db.enc` (never printed)                                                                                    |
| 6   | O   | `node $C/owner/o2-primary-db-url.mjs`                                                                              | builds `PRIMARY_DB_URL` (session pooler 5432, `app_be.<ref>`), verifies by connecting as `app_be`, seals it into `api.enc`; commit `api.enc`       |
| 7   | O   | `node $C/owner/o3-gh-secrets.mjs` (after `source $C/owner/load-age-key.sh`)                                        | sets the one GitHub `production` secret `SOPS_AGE_KEY` from your shell without echoing it and lists the required secrets/variables; no blob push  |
| 8   | C   | `node $C/04-platform-admins.mjs --execute`                                                                         | inserts the emails of `NIVO_PLATFORM_ADMINS` into `platform_admins` (`on conflict do nothing`)                                                     |
| 9   | C   | `node $C/05-deploy.mjs --execute`                                                                                  | `gh workflow run` + watch: api, then edge, then web; gate after the edge (`api.nivo.vn/healthz` 200) and after the web (`nivo.vn/health/live` 200) |
| 10  | C   | `node $C/06-seed.mjs --execute` (`--build` the first time)                                                         | `cli seed-media upload`, `cli seed-modules run` (upserts, deletes nothing)                                                                         |
| 11  | C   | `node $C/07-smoke.mjs` (optional `--login`)                                                                        | health, GraphQL `{__typename}`, unauthenticated refusal, `/api/v1`, `select public.job_stats()` as `app_be`                                        |
| 12  | O   | the manual smoke list (section "Verify")                                                                           | watch one hour, then enable the nightly backup                                                                                                     |
| R   | C   | `node $C/08-rollback.mjs --execute` (`--layer web\|edge\|engine\|all`)                                             | the old workflows from the tag `pre-lite-cutover`; the schema is never rolled back                                                                 |

Steps 5 and 6 need the schema of step 4 (role `app_be` exists after the baseline) and come before step 9. `o3` and `envmap.mjs` were reduced to this delivery (no `*_ENV` blob is pushed). Step 13 (`09-post-cutover.mjs`) is NOT part of the cutover day: see the Database section.

## Database

Production recorded the OLD migration versions (origin/main names). `03-db-migrate.mjs` performs the steps below; the map from old to new versions is `be/docs/runbooks/migration-restamp.md`.

1. Link the CLI to the production project (`supabase link --project-ref <ref>`, or pass `--db-url "$ADMIN_DB_URL"`).
2. Repair the history: every row of the restamp map whose version changed is marked reverted (old) and applied (new):

   ```bash
   awk -F'|' '$4 ~ /->/ {gsub(/ /,"",$4); split($4,v,"->"); print v[1], v[2]}' be/docs/runbooks/migration-restamp.md |
   while read -r old new; do
     supabase migration repair --status reverted "$old"
     supabase migration repair --status applied "$new"
   done
   supabase migration list
   ```

3. Apply the migrations the conversion lanes added after origin/main (they live in `supabase/migrations/_archive/` beside the ones production ran); push them from a scratch project folder (`../nivo-archive`) so the CLI sees them as migrations. Read the dry run: it must list only conversion migrations, never one production ran under an old name.
4. Switch the history to the baseline: revert the archived versions, mark `20261013142504` applied without running it, then `supabase db push --dry-run` must list only `20261013142505_lite-baseline-standard.sql`; `supabase db push` applies it (`03-db-migrate.mjs` pushes from a scratch project that holds only the baseline pair, so the held-back migration cannot ride along). `lite-baseline-standard` brings privileges and policy names to the baseline standard. **Held back, step 13 (`node $C/09-post-cutover.mjs --execute`, gated on 48 h after the last green `07-smoke` or `--owner-confirms-old-app-gone`):** `drop-engine-schema` (its stamp `20261020110000` collides with no origin/main version and no restamp target; it equals the version of the archived `drop-operations-commands`, whose row the baseline switch reverts first; it sorts after the baseline pair) unschedules the legacy pg_cron jobs whose command calls the engine or pg_net (the pgmq ticks the api upserts itself at boot, and the four baseline jobs, are kept) and drops the dead `engine_jobs`, `engine_workers`, `cron_targets`, the `engine_*` functions, `zalo_refresh_tick` and the vault secret `engine_sweep_secret`. Before pushing, look at what production schedules: `select jobid, jobname, schedule, command from cron.job;` as the owner role. The extension `pg_net` stays installed.
5. Set the password of the api's database role (never in a migration) with `o1`, and build `PRIMARY_DB_URL` with `o2` (session-mode pooler, port **5432**, user `app_be.<project-ref>`; the api keeps a connection pool, so not the transaction pooler on 6543).
6. Check the grants: connect as `app_be` (`select count(*) from public.queue`). pgmq gets its queues from the api's first boot: `select * from pgmq.list_queues();` lists the queues of `API_JOB_QUEUES` afterwards.
7. The old chat queue (`engine_jobs`) is dropped by step 4: drain it first if anything is `queued` or `running` (`select status, count(*) from engine_jobs group by 1;`), otherwise those jobs are lost (chat turns fall back to the direct processor).

## Secrets: what the sealed files hold and where they go

Custody is `.starcistacks/production/secrets/<slug>.enc` (names per file in `.starcistacks/production/README.md`; values are never recorded in this repository or in chat). The deploy mapping:

| Sealed                                                                                       | Reaches                    | How                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.enc` + `auth.enc` + `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_MANAGE_AGENTS` from `stack.enc` | the api container          | one file per key in `~/nivo-engine/deploy/secrets/api`, pointers `<KEY>_FILE` in the generated `api.env`; the committed non-secret config is `deploy/stack/api-public.conf`       |
| `stack.enc` secrets (`OPENCLAW_GATEWAY_TOKEN`, `N8N_ENCRYPTION_KEY`, `N8N_DB_PASSWORD`)      | openclaw-init, n8n, n8n-db | files in `secrets/stack`, read through `*_FILE` (OpenClaw itself keeps its gateway token and provider keys in `openclaw.env`, mode 600, because its image has no `_FILE` support) |
| `stack.enc` settings (tags, model, `API_BIND`, watchdog thresholds)                          | compose `.env`             | copied by `deploy/materialize.mjs`; other keys are ignored                                                                                                                        |
| `web.enc` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)                      | web build arguments        | read in the web workflow; the web container has no runtime env                                                                                                                    |
| `ops.enc`, `app-be-db.enc`, `test-accounts.enc`                                              | cutover scripts only       | never reach GitHub                                                                                                                                                                |

Seal or change a value (stdin or `--generate`, never argv): `starci app secret set production api --key OPENCLAW_TOOL_SECRET --generate 32`. List names: `starci app secret list production`. Until the canon repin, `deploy/materialize.mjs` (plain sops) is the materialize step; afterwards `starci app secret materialize production` replaces it.

### What the be needs (api container environment)

Read from the be config files (`be/src/modules/**/**.config.ts`, `be/apps/api/src/main.ts`). R = the api stops at boot with the key name when it is missing, O = optional (the capability turns off or a default applies), T = tunable with a literal default. Booleans are `true` or `false`.

Core and database

- `PORT` (R, 8787, set by compose), `PRIMARY_DB_URL` (R, role `app_be`, session pooler, sealed), `PRIMARY_DB_SCHEMA` (R, `public`, `api-public.conf`)
- `SUPABASE_URL` (R), `SUPABASE_SERVICE_ROLE_KEY` (R), `SUPABASE_ANON_KEY` (O)
- `HTTP_SECURITY_ALLOWED_ORIGINS` (R, `https://nivo.vn,https://www.nivo.vn`, `api-public.conf`)
- `HTTP_SECURITY_RATE_WINDOW`, `HTTP_SECURITY_RATE_DEFAULT_LIMIT`, `HTTP_SECURITY_RATE_STRICT_LIMIT` (T)

Identity, URLs and crypto

- `CHANNEL_TOKEN_KEY` (R; the AES key that seals every connection token; losing it means every connection must be reconnected)
- `SITE_URL` (R; `https://nivo.vn`), `PUBLIC_SITE_URL` (O; `https://nivo.vn`), `PUBLIC_API_URL` (O; `https://api.nivo.vn`). Provider webhook URLs and OAuth callbacks are built from `PUBLIC_API_URL`, falling back to `PUBLIC_SITE_URL`
- `NIVO_PLATFORM_ADMINS` (O, comma list of emails; the platform admins also come from the `platform_admins` table)
- `WORKSPACE_SIGNUP_ENABLED` (T, default false), `INVITE_VALID_DAYS` (T)

Payments and bank feeds

- `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NAME` (O as a group, needed for billing)
- `BANK_WEBHOOK_SECRET` (O; the shared secret of the Vietcombank feed), `TELEGRAM_WORKSPACE_ID` (O; workspace that receives simulated bank credits)
- `SEPAY_SIMULATE_URL` (O, local simulator only)

Channels and providers

- `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` (O as a group: all or none), `META_GRAPH_VERSION`, `META_LOGIN_CONFIG_ID`, `META_SEND_PER_MINUTE`, `META_TIMEOUT`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (O; fall back to `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` of `auth.enc`), `GOOGLE_OAUTH_BASE`, `GOOGLE_SHEETS_BASE`, `GOOGLE_TIMEOUT`
- `ZALO_API_BASE`, `ZALO_OAUTH_BASE`, `ZALO_TIMEOUT`; `TELEGRAM_API_BASE`, `TELEGRAM_TIMEOUT`; `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` (O as a pair, personal Telegram data source); `CHANNEL_SETUP_TIMEOUT`, `CHANNEL_BOT_TOKEN` (O, provisioning cli)
- Per-connection webhook secrets (Telegram, Zalo, Casso, payOS, SePay feed) are generated and stored per connection in the database; there is no global env for them.
- `WEBHOOK_SIGNING_SECRET` (O; the root of the per-workspace signing keys of customer outbound webhooks, `api.enc`; absent means webhook signing is unavailable and outbound events are not sent), `WEBHOOK_DELIVERY_TIMEOUT` (T)

Agents, models, automation

- `OPENCLAW_GATEWAY_URL` (set by compose) plus `OPENCLAW_GATEWAY_TOKEN` or `OPENCLAW_GATEWAY_PASSWORD` (O as a group; without them the chat turn path is "not configured" and answers fall back), `OPENCLAW_TOOL_SECRET` (O, signs the tool bridge), `OPENCLAW_MANAGE_AGENTS` (T, `true` or `false`), `OPENCLAW_TURN_TIMEOUT` (T, duration), `OPENCLAW_SETTLE_DELAY`, `OPENCLAW_CONFIG_DIR`, `OPENCLAW_GATEWAY_STATE_DIR`
- `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL` (all O; without a key embeddings and extraction turn off), `AI_JSON_RETRIES`
- `N8N_SIGNING_SECRET` (R), `N8N_WEBHOOK_BASE` (R in the runbook set; `http://n8n:5678/webhook/nivo-events`), `N8N_ALLOWED_HOSTS`, `N8N_EMIT_TIMEOUT`, `N8N_CONTAINER`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` (O; n8n host control by the CLI; the key and known hosts are the file CONTENT, read through `_FILE`)
- `SMTP_URL`, `SMTP_FROM` (O as a pair), `SMTP_HELLO_NAME`, `SMTP_ALLOW_PRIVATE_HOSTS`; `DATA_ALLOW_PRIVATE_HOSTS`
- `QUEUE_ENABLED`, `QUEUE_CONCURRENCY`, `QUEUE_WORKSPACE_CONCURRENCY`, `QUEUE_POLL_INTERVAL`, `QUEUE_VISIBILITY_TIMEOUT`, `QUEUE_SHUTDOWN_GRACE`, `JOBS_LEASE`, `JOBS_WORKER_ID` (T)
- `VIDEO_CACHE_DIR`, `VIDEO_WORK_DIR`, `VIDEO_FONTS_DIR`, `VIDEO_FFMPEG_NICE`, `VIDEO_FFMPEG_THREADS`, `VIDEO_MAX_SECONDS`, `VIDEO_TTS_PROVIDER`, `VIDEO_TTS_MIN_GAP_MS` (T)

Stack settings (`stack.enc`, copied to the compose `.env`, not read by the be): `OPENCLAW_IMAGE`, `OPENCLAW_TAG`, `OPENCLAW_MODEL`, `N8N_TAG`, `N8N_ALLOWED_HOSTS`, `API_BIND` (default `172.29.0.1`), `JOBS_FAILED_ALERT`, `JOBS_STALE_SECONDS`; `API_TAG` is added by the workflow.

### What the fe needs (build arguments, public by design)

Every value is a `NEXT_PUBLIC_*` build argument; the web container has no server-side secret.

- `NEXT_PUBLIC_SUPABASE_URL` (R), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (R): from `web.enc`
- `NEXT_PUBLIC_API_URL` (R; the origin the Apollo client calls: `https://api.nivo.vn`, GraphQL at `/graphql`; the workflow and Dockerfile default to it)
- `NEXT_PUBLIC_DEVELOPER_API_URL` (R by the Developers page; `https://api.nivo.vn`)
- `NEXT_PUBLIC_SITE_URL` (`https://nivo.vn`)

## Owner steps on the day (by hand)

1. **DNS**: the `api.nivo.vn` A record must already exist (section 0). DNS is edited in the Tino panel only (`be/docs/runbooks/dns-rollback.md`); no agent edits it.
2. **platform_admins** are inserted by step 8; `NIVO_PLATFORM_ADMINS` in `api.enc` also grants the be-side admin routes, the table drives `is_platform_admin()` in RLS.
3. **Provider webhooks and callbacks**: the new `api.nivo.vn` URIs were added before the cutover (section "Hosts"); the old `nivo.vn` ones keep working. Optional: re-save a Telegram connection (re-registers `setWebhook` on the new host) and check `getWebhookInfo` has no `last_error_message`.
4. **Seed data** (step 10): `cli seed-media upload` (music beds into the media bucket) and `cli seed-modules run` (module catalogue and authority actions; run it before the first smoke test, the agents page is empty without it).

### Provider webhook URLs

All paths are served by the api on `https://api.nivo.vn`; the same paths on `https://nivo.vn` and `www` still work for the URLs customers already configured. The be builds the URL it shows and registers from `PUBLIC_API_URL`. Per-connection URLs are shown on the connection's page and are registered automatically for Telegram and Zalo when the connection is (re)saved; the others are pasted into the provider's dashboard.

| Route (be)                                          | URL                                                        | Provider and what it needs                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /api/telegram/:connectionId`                  | `https://api.nivo.vn/api/telegram/<connectionId>`          | Telegram `setWebhook` (header `x-telegram-bot-api-secret-token`)                                             |
| `POST /api/connections/zalo/:connectionId`          | `https://api.nivo.vn/api/connections/zalo/<connectionId>`  | Zalo OA webhook in the Zalo developer console                                                                |
| `POST /api/connections/casso/:connectionId`         | `https://api.nivo.vn/api/connections/casso/<connectionId>` | Casso webhook (`x-casso-signature`, or V1 `secure-token`)                                                    |
| `POST /api/connections/payos/:connectionId`         | `https://api.nivo.vn/api/connections/payos/<connectionId>` | payOS webhook URL in the payOS dashboard                                                                     |
| `POST /api/connections/sepay/:connectionId`         | `https://api.nivo.vn/api/connections/sepay/<connectionId>` | SePay webhook of a workspace's bank feed (`Authorization: Apikey <key>` generated for the connection)        |
| `POST /api/sepay/webhook`                           | `https://api.nivo.vn/api/sepay/webhook`                    | SePay webhook of the platform's own account (billing); `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`       |
| `POST /api/bank/vietcombank`                        | `https://api.nivo.vn/api/bank/vietcombank`                 | The Vietcombank forwarder (header `x-nivo-bank-secret` = `BANK_WEBHOOK_SECRET`)                              |
| `GET/POST /api/connections/meta/webhook`            | `https://api.nivo.vn/api/connections/meta/webhook`         | Meta app > Webhooks. Verify token = `META_WEBHOOK_VERIFY_TOKEN`                                              |
| `GET /api/connections/meta/callback`                | `https://api.nivo.vn/api/connections/meta/callback`        | Meta app > Facebook Login > Valid OAuth Redirect URIs                                                        |
| `GET /api/connections/google/callback`              | `https://api.nivo.vn/api/connections/google/callback`      | Google Cloud OAuth client > Authorized redirect URIs                                                         |
| `/api/n8n/data/*`, `/email`, `/runs/:id/complete`   | `https://api.nivo.vn/api/n8n/...`                          | n8n workflows that call back into the api: point their HTTP nodes at the compose-internal address of the api |
| `/api/v1/{messages,events,leads,knowledge,loyalty}` | `https://api.nivo.vn/api/v1/...`                           | The public API customers integrate with (API keys); the Developers page documents the host                   |
| `POST /graphql`                                     | `https://api.nivo.vn/graphql`                              | The fe's Apollo client (`NEXT_PUBLIC_API_URL` + `/graphql`)                                                  |
| `GET /health/live`, `/healthz`, `/readyz`           | `https://api.nivo.vn/healthz`                              | Monitors (`/health/live` of the product hosts is the web container's)                                        |

Internal only (never public): `/agent-tools/...` (OpenClaw's tool bridge, signed with `OPENCLAW_TOOL_SECRET`, reachable on the docker bridge, not through the edge).

## Deploy

Merge `lite/convert` into `main` (step 3; nothing deploys), then step 9 runs the workflows (or run them by hand in Actions, in this order):

1. **Deploy api**: builds the image on the runner, decrypts the sealed files with `SOPS_AGE_KEY`, ships the image, the stack files and the secret files, swaps `~/nivo-engine`, replaces the `engine` container with `api` (`--remove-orphans`), waits for `healthy` and `/readyz`, and restores the previous release when that fails. Check: `ssh vps 'cd ~/nivo-engine/deploy && docker compose --env-file .env ps && docker compose --env-file .env logs --tail 50 api'`; `~/nivo-engine/watchdog.log` shows no `ALERT`.
2. **Deploy edge**: Traefik reloads the routes. Check: `curl -fsS https://api.nivo.vn/healthz` and `curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://api.nivo.vn/graphql -H 'content-type: application/json' -d '{"query":"{__typename}"}'` (200 or a 400/401 JSON, never a Next 404 page).
3. **Deploy web**: builds `fe/apps/web/Dockerfile` from the repository root with the public build arguments, ships the image, starts `nivo-web:<sha>` and rolls back to the previous tag when it is not healthy.

The fe build: `fe/apps/web/next.config.ts` sets `output: "standalone"`; the Dockerfile copies `.next/standalone` and starts `node fe/apps/web/server.js`. Netlify builds nothing after auto publishing is off and the repository has no `netlify.toml`; its last good deploy is the DNS rollback target.

## Verify the system (smoke checklist)

- [ ] **Login**: sign in at `https://nivo.vn/login` with email and password, and with Google. The browser calls `https://api.nivo.vn/graphql` with a bearer token (Network tab: 200, no CORS error). Sign out and in again.
- [ ] **Console**: `/dashboard` and `/agents` render real data (seeds ran), no 401/403 loop.
- [ ] **Chat turn**: send a Telegram test message to a connected bot; it arrives in `/inbox` and the agent answers through OpenClaw (the reply is not `direct_fallback`). `docker compose --env-file .env logs --since 10m api` shows the turn with no repeating error.
- [ ] **Payment webhook**: trigger a SePay delivery (a small real transfer, or the SePay simulator against `https://nivo.vn/api/sepay/webhook`); the order in `/billing` becomes paid and the credits appear. A request without the `Authorization: Apikey` header is refused with 401.
- [ ] **Booking**: open the public page `https://nivo.vn/b/<slug>`, book a slot; it appears in the workspace's booking list.
- [ ] **Automation tick**: `select public.job_stats();` shows the `automation` and `shifts_alerts` queues moving; `failed24h` stays small; no `ALERT` in `~/nivo-engine/watchdog.log`. `select jobname, command from cron.job` lists the four baseline jobs and the pgmq ticks of the api schedulers, no job calling `net.http_post` or an `engine_*` function.
- [ ] **Agent sync**: after a change in `/agents` the OpenClaw agent `ws-<first 8 characters of the workspace id>-chatbot` reflects it within one interval.
- [ ] **Knowledge**: upload a small document in `/knowledge`; it goes from waiting to `ready`.
- [ ] **Connections**: a Google or Meta authorisation round trip lands back in the app.
- [ ] **Outbound webhooks**: an event for a workspace with a webhook subscription is delivered and signed (`WEBHOOK_SIGNING_SECRET` is set).
- [ ] **Rate limiting** is per client, not per proxy: two different clients both get 200 on a burst that would exceed the limit for one address.
- [ ] n8n events still arrive (`N8N_WEBHOOK_BASE` is the compose-internal URL).
- Watch for an hour, then enable the nightly backup (`be/docs/runbooks/vps-stack.md`, Backup).

## Rollback

Decide quickly: after the api deploy the old web is still live, after the edge only the `/api/` paths moved, after the web everything moved. Roll back in the reverse order with `node $C/08-rollback.mjs --execute --layer web|edge|engine|all`, which runs the OLD workflows from the tag `pre-lite-cutover` (the old workflows build the old code). The old web does not call the new api, so each layer can be reverted on its own.

1. **Web**: the old Deploy web from the tag, or start the previous image still on the host: `ssh vps 'bash ~/nivo-web/remote-deploy.sh "$(cat ~/nivo-web/.tag.prev)"'`.
2. **Edge**: the old Deploy edge from the tag; the old routes send `/api/` back to the web container. Provider dashboards need no change (the URLs never moved).
3. **Engine**: the old Deploy engine from the tag; it rebuilds the engine on the VPS and replaces the `api` container (same compose project, volumes untouched). `~/nivo-engine.prev` holds the previous release if a manual start is quicker. The old engine reads its own `.env`; the plaintext secret files of the previous release are removed after a healthy deploy, so a rollback after a later deploy goes through a redeploy.
4. **Database**: do not roll the schema back. Migrations are forward-only. Until `09-post-cutover.mjs` has run, the engine tables still exist, so the old engine and web roll back cleanly; after it a rollback of the engine needs a restore from the backup. if a migration breaks the old code, fix it with a new forward migration (the backup is the last resort). If the drop migration has already been applied (step 13), the old engine's queue (`engine_jobs`) is gone: roll back the engine only together with a restore of that table from the backup. Return the history to the old file names only if you must run the OLD `db-deploy.yml` from the tag (reverse the repair loops of the Database section).
5. **Secrets**: nothing to undo. Keep the old plaintext custody backup (`C:\Users\Hi\.nivo-lite\_backup-20261003`) until the cutover is accepted; the owner deletes it afterwards.
6. **DNS** (only if the VPS itself is lost): in the Tino panel point the apex A record back at the previous address written down before the cutover (`be/docs/runbooks/dns-rollback.md`); in Netlify use "Publish deploy" on the last pre-cutover deploy.

## After the cutover

- Restore push triggers on the deploy workflows only if you want deploys on merge again.
- Retire the engine vocabulary left in the stack: the compose project keeps the name `nivo-engine` on purpose (the volume names depend on it); the sealed keys `ENGINE_*` and the other obsolete keys listed in `.starcistacks/production/README.md` are deleted by the owner.
- Delete the Netlify site and its build hook; delete `C:\Users\Hi\.nivo-lite\_backup-20261003` after every sealed key is verified; revoke the Cloudflare token (the zone was never there).
- Switch `deploy/materialize.mjs` to `starci app secret materialize` after the canon repin.
- Update the provider-facing guide only if a public path changed (`be/docs/guides/connecting-channels.md`).
