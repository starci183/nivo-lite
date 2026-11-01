# Cutover: from the engine and Next route handlers to the api

This is the runbook for the day `lite/convert` becomes `main`, kept as the record of that cutover and of the reasons behind the current layout. Nothing in the
conversion branch deploys by itself: the deploy workflow (`.github/workflows/stack-deploy.yml`) has no push trigger and runs by hand only. **Deploy stack** handles deployment and rollback through its `operation` input; the current procedure is `be/docs/runbooks/vps-stack.md`. **Production runs on Docker Swarm** (one VPS, single-manager swarm), not on Docker Compose: the three compose deploy workflows (api, edge and web) and the host crontab watchdog no longer exist on this branch; they stay reachable only from the rollback tag `pre-lite-cutover` (the old model).

The cutover scripts live next to the integrator's notes in `D:/starci-tmp/nivo-lite-lanes/cutover/` (they are not in this repository; the READY.md there is the dry-run report). Their current copies still describe automatic host-cron removal and restoration, and the preflight and rollback scripts (steps 1 and R) still reference the removed stack rollback workflow: update those external copies before using the affected steps. Follow this page for manual watchdog retirement and the direct rollback dispatch. Every mutating script is a dry run unless it gets `--execute` AND the environment holds the cutover arming flag (set to 1); the owner scripts (`owner/o*.mjs`) refuse to run inside an agent session. A short Vietnamese checklist of the owner-only steps is in `D:/starci-tmp/nivo-lite-lanes/CUTOVER-OWNER.md`.

## What lite/convert is now

- **The be is the single API.** One Nest app (`be/apps/api`) serves GraphQL at `/graphql` (contract `be/contracts/api/schema.graphql`), the REST webhooks and OAuth callbacks (`/api/...`), the public v1 API (`/api/v1/...`), the n8n callbacks (`/api/n8n/...`), the OpenClaw tool bridge (`/agent-tools`, internal), and runs the pgmq jobs and the sagas (schedulers: automation tick, shifts tick, agents sync, decisions drain, content tick, connection health, zalo refresh, data sync). `be/apps/cli` is the operator CLI (`migrate run`, `seed-media upload`, `seed-modules run`, `jobs ...`).
- **The fe calls the be through Apollo** (`fe/apps/web/src/modules/api/graphql`: auth and no-auth clients, the own-auth access token as the bearer, SWR hooks). The browser signs in through the api's `/auth` doors. There are no Server Actions and no Next route handlers except `/health/live` and the auth callback. The REST controllers that duplicated GraphQL were deleted; REST stays for public v1, provider webhooks and OAuth callbacks, the n8n callbacks and the agent tools.
- **The migration history is one baseline.** `db/migrations/` holds `20261026000000_baseline.sql` and the forward migrations after it; the earlier files are history in `db/migrations/archive/`. Production starts on an empty database (section "Database"), so nothing is held back.
- **Secret custody** is `.starcistacks/production/secrets/<slug>.enc` (sops + age). The age identity lives in the StarCi runtime secret file (the owner backs it up). The deploy decrypts in the job with the age identity (a protected GitHub environment secret) in memory and pipes each key into a versioned Swarm secret (`docker secret create nivo-<key>-v<keyed hash> -`); the containers read `/run/secrets/<NAME>` through `<NAME>_FILE`. No dotenv blob lives in GitHub and no plaintext file lives on the VPS.

## Hosts: nivo.vn and www.nivo.vn (landing), app.nivo.vn (console), api.nivo.vn (api)

The zone `nivo.vn` is at **Tino** (`ns1.tino.vn`, `ns2.tino.vn`). `nivo.vn`, `www.nivo.vn`, `app.nivo.vn` and `api.nivo.vn` already have A records pointing at `103.142.27.9` (the VPS). Verify all four before the cutover; DNS changes are manual in the Tino panel. `app-vps.`, `engine.` and `n8n.nivo.vn` do not resolve and are optional: no required config names them.

- `PUBLIC_API_URL=https://api.nivo.vn`; the web build points its API origin and its developer API origin at the same host (build arguments of the web image). The api allows the browser origins `https://app.nivo.vn`, `https://nivo.vn` and `https://www.nivo.vn` (`HTTP_SECURITY_ALLOWED_ORIGINS`). `SITE_URL` and `PUBLIC_SITE_URL` are `https://app.nivo.vn` for browser returns and invite links.
- The ingress (`.starcistacks/production/infra/swarm/edge/routes.yml`, Traefik as the `ingress` service of the stack) obtains a Let's Encrypt certificate for each of `nivo.vn`, `www.nivo.vn`, `app.nivo.vn` and `api.nivo.vn`; it routes `api.nivo.vn` to the api. It ALSO keeps sending `/api/**`, `/graphql` and `/healthz` of `nivo.vn` and `www.nivo.vn` to the api (priority 100), so the per-connection webhooks customers configured with the old `https://nivo.vn/api/...` URLs keep working; `/graphql` on `nivo.vn` is a compatibility route. Other paths on `nivo.vn` and `www.nivo.vn` reach the `landing` service (priority 10); app paths such as `/login` return 308 to the same path and query on `app.nivo.vn`. The `web` service serves the console on `app.nivo.vn`. Each web service has its own `/health/live`.
- n8n is private (no published port; the operator reaches the editor with a loopback-only tunnel container and `ssh -L`, see section 5 of `be/docs/runbooks/vps-stack.md`; the api calls it as `http://n8n:5678` on the private `automation` overlay network).
- **Before the cutover, add the new provider URIs** (adding them does not break the old ones; keep the old ones too): Meta app > Facebook Login > Valid OAuth Redirect URIs `https://api.nivo.vn/api/connections/meta/callback`; Meta app > Webhooks `https://api.nivo.vn/api/connections/meta/webhook` (same verify token); Google Cloud OAuth client > Authorized redirect URIs `https://api.nivo.vn/api/connections/google/callback`; SePay platform webhook `https://api.nivo.vn/api/sepay/webhook`. Per-connection webhooks (Telegram, Zalo, Casso, payOS, SePay feed) may stay on the old `nivo.vn` URLs; re-saving a connection registers the new host.
- Access tokens are ES256; the api verifies them against its own JWKS.

What changes in production:

| Before                                                                                | After                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine` container in OpenClaw's network namespace (port 8787), built on the VPS      | `api` Swarm service (`be/apps/api`) on its own overlay networks, reaching OpenClaw by service DNS (`openclaw:18790`); image built on the GitHub runner, pushed to GHCR and deployed by digest |
| webhooks, OAuth callbacks and `/api/*` served by Next route handlers                  | the same public paths served by the api; the edge sends `api.nivo.vn` and every `/api/` path of `nivo.vn` and `www.nivo.vn` to it                                                             |
| the browser talks to the hosted auth service and to Next server actions               | the browser signs in through the api's own auth doors and calls `https://api.nivo.vn/graphql` with the user's access token                                                                    |
| the service role in Next and in the engine                                            | no service role: the api alone reaches the database, as the least-privilege role `app_be`                                                                                                     |
| secrets in a plaintext dotenv file, pushed as `*_ENV` blobs                           | secrets in `.starcistacks/production/secrets/*.enc`, materialized per key at deploy time                                                                                                      |
| Netlify as a hot fallback                                                             | retired (turn its auto publishing off; its last good deploy stays for a DNS rollback)                                                                                                         |
| Docker Compose projects `nivo-edge`, `nivo-engine`, `nivo-web` and a crontab watchdog | one Swarm stack `nivo` (`ingress`, `web`, `landing`, `api`, `openclaw`, `n8n`), no host cron; job alerts are raised by the api itself                                                         |

## Order and why

The scripts below run: preflight, merge, database, owner secrets steps, platform admins, then **one Deploy stack run** (api, web, landing, ingress, openclaw and n8n are one Swarm stack; 15 to 25 minutes including the image builds). The public door is down only for the **cutover window** ("Docker Swarm cutover window" below): the time between stopping the compose model and the first healthy Swarm tasks, about one to two minutes with the images pre-pulled. `PRIMARY_DB_URL` and the other sealed names must exist before the api deploy (the api refuses to start without them). Notation: **C** = the integrator runs it (a dry run until the owner says go), **O** = the owner runs it. `C=D:/starci-tmp/nivo-lite-lanes/cutover`.

## 0. Before (days ahead, owner)

1. Back up the StarCi runtime secret file (it holds the age identity; losing it loses every sealed secret).
2. Database: production starts clean and no data is carried over; the nightly backup (`be/docs/runbooks/vps-stack.md`, Backup) starts after the first green smoke.
3. Netlify: Site configuration > Build & deploy > turn **Auto publishing** off (do not delete the site).
   3b. DNS (Tino panel): verify `nivo.vn`, `www.nivo.vn`, `app.nivo.vn` and `api.nivo.vn` resolve to `103.142.27.9` with `nslookup <host> 1.1.1.1`. Add the new OAuth / webhook URIs of the "Hosts" section in the Meta, Google and SePay consoles.
4. Own auth: **at cutover**, set `AUTH_WEB_ORIGIN` to `https://app.nivo.vn` and `AUTH_GOOGLE_CALLBACK_URL` to `https://api.nivo.vn/auth/google/callback`, and add that callback to the Google OAuth client's authorized redirect URIs. Keep the old hosts there for links sent before cutover.
5. GitHub environment `production`: add the age-identity secret (its name is in `.github/workflows/stack-deploy.yml`) and protect the environment with required reviewers. The CI transport is the sealed member `vps-ci`; GitHub keeps no `VPS_*` name; the Let's Encrypt contact variable is optional. The public API origin variables of the web build are optional (they default to `https://api.nivo.vn`). The old per-service `*_ENV` secrets and the `WEB_NEXT_PUBLIC_*` secrets are not used by the new workflows, but the OLD workflows run from the tag for a rollback still read them: keep them until the cutover is accepted, then delete them.
6. Check the sealed names (the lists below) and re-seal what is wrong with `starci app secret set production <slug>`. Open items: `OPENCLAW_TOOL_SECRET` (agent tool bridge), the Meta trio if Meta connections are wanted, `SEPAY_WEBHOOK_API_KEY` and `SEPAY_ACCOUNT_NAME` (look like placeholders), `N8N_SIGNING_SECRET` (must equal what the n8n workflows sign with), and the obsolete keys listed in `.starcistacks/production/README.md`.
7. Commit the sealed-file changes on `lite/convert`.
8. **Approve `docker swarm init` on the VPS** (the new one-time owner step, "Docker Swarm cutover window"). The cutover script runs `starci app stack prepare --env production --init-swarm --owner-approved --execute` only after the owner's yes.

## The day

| #   | Who | Command                                                                                                                                                | What it does                                                                                                                                                                                                                                                                                  |
| --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | C   | `node $C/01-preflight.mjs`                                                                                                                             | read-only: tools, key, refs, sealed files, gh, JWKS, DNS, env gaps                                                                                                                                                                                                                            |
| 2   | O   | `source $C/owner/load-age-key.sh` ; export the owner connection string of the loopback relay (`db-runbook.md`) as the scripts' admin database variable | one shell for steps 3 to 9 (never paste these in chat)                                                                                                                                                                                                                                        |
| 3   | C   | `node $C/02-merge-main.mjs`, then on the owner's word `node $C/02-merge-main.mjs --execute` with the arming flag set                                   | tags `pre-lite-cutover` (rollback point) and fast-forwards `main` to `lite/convert` (non-force)                                                                                                                                                                                               |
| 4   | C   | `node $C/03-db-migrate.mjs --dry-run`, then `--execute`                                                                                                | section "Database" below, idempotent; needs the admin database variable                                                                                                                                                                                                                       |
| 5   | O   | `node $C/owner/o1-set-app-be-password.mjs`                                                                                                             | sets the `app_be` password from the `app-be-db` member of `.starcistacks/production/secrets/` (never printed)                                                                                                                                                                                 |
| 6   | O   | `node $C/owner/o2-primary-db-url.mjs`                                                                                                                  | builds `PRIMARY_DB_URL` (`postgresql://app_be@db:5432/postgres`), verifies by connecting as `app_be`, seals it into the `primary` member of `.starcistacks/production/secrets/`; commit it                                                                                                    |
| 7   | O   | `node $C/owner/o3-gh-secrets.mjs` (after `source $C/owner/load-age-key.sh`)                                                                            | sets the one GitHub `production` secret (the age identity) from your shell without echoing it and lists the required secrets/variables; no blob push                                                                                                                                          |
| 8   | C   | `node $C/04-platform-admins.mjs --execute`                                                                                                             | inserts the emails of the platform admins list into `platform_admins` (`on conflict do nothing`)                                                                                                                                                                                              |
| 8b  | C   | `node $C/05a-swarm-prepare.mjs --execute` (owner approval)                                                                                             | `starci app stack prepare --init-swarm --owner-approved --execute`; creates `/srv/nivo/releases` and the volumes; never touches an active swarm                                                                                                                                               |
| 9   | C   | `node $C/05-deploy.mjs --execute --retire-compose`                                                                                                     | `gh workflow run stack-deploy.yml`, then `starci app stack retire --execute` for the three old compose projects, and watch; its verify step is the gate (`api.nivo.vn/healthz` and `/readyz`, landing `nivo.vn/health/live` and `www.nivo.vn/health/live`, console `app.nivo.vn/health/live`) |
| 10  | C   | `node $C/06-seed.mjs --execute` (`--build` the first time)                                                                                             | `cli seed-media upload`, `cli seed-modules run` (upserts, deletes nothing)                                                                                                                                                                                                                    |
| 11  | C   | `node $C/07-smoke.mjs` (optional `--login`)                                                                                                            | health, GraphQL `{__typename}`, unauthenticated refusal, `/api/v1`, `select public.job_stats()` as `app_be`                                                                                                                                                                                   |
| 12  | O   | the manual smoke list (section "Verify")                                                                                                               | watch one hour, then enable the nightly backup                                                                                                                                                                                                                                                |
| R   | C   | `gh workflow run stack-deploy.yml --ref main -f operation=rollback`                                                                                    | previous accepted release; the schema is never rolled back                                                                                                                                                                                                                                    |

Steps 5 and 6 need the schema of step 4 (role `app_be` exists after the baseline) and come before step 9. `o3` and the env-map helper were reduced to this delivery (no `*_ENV` blob is pushed).

## Database

Production runs on the self-hosted `db` service and starts clean: `db/bootstrap.sql` first, then every migration in order, forward-only. No data and no migration history of the earlier hosted database is carried over (owner ruling 2026-10-29). The first start, the `app_be` password, the backups and the restore are in `.starcistacks/production/infra/swarm/recovery/db-runbook.md`; step 4 of the day performs the first start. After it:

1. Set the password of the api's database role (never in a migration) with `o1`, and build `PRIMARY_DB_URL` with `o2` (`postgresql://app_be@db:5432/postgres`; the api keeps a connection pool).
2. Check the grants: connect as `app_be` (`select count(*) from public.job_outbox`).

## Secrets: what the sealed files hold and where they go

Custody is `.starcistacks/production/secrets/<slug>.enc` (names per file in `.starcistacks/production/README.md`; values are never recorded in this repository or in chat). The deploy mapping:

| Sealed                                                                                                                                                                                                                                 | Reaches              | How                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the `api` member of `.starcistacks/production/secrets/` + the `auth` member of `.starcistacks/production/secrets/` + `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_MANAGE_AGENTS` from the `stack` member of `.starcistacks/production/secrets/` | the api service      | one Swarm secret per key (`nivo-<key>-v<hash>`) at `/run/secrets/<KEY>`, pointers `<KEY>_FILE` in the rendered environment; the committed non-secret config is `.starcistacks/production/infra/swarm/api-public.conf` |
| the `stack` member of `.starcistacks/production/secrets/` secrets (`OPENCLAW_GATEWAY_TOKEN`, the n8n encryption key)                                                                                                                   | openclaw, n8n        | Swarm secrets read through `*_FILE` (OpenClaw has no `_FILE` support: its entrypoint wrapper exports the gateway token and the provider keys from `/run/secrets` into the gateway process; no env file on the host)   |
| the `stack` member of `.starcistacks/production/secrets/` settings (OpenClaw model, `N8N_ALLOWED_HOSTS`, job alert limits)                                                                                                             | the rendered stack   | read by `starci app stack render` (non-secret, part of the config digest); other keys are ignored. Image tags are pinned by digest in `.starcistacks/production/infra/swarm/stack.yaml` now                           |
| the `ops` member of `.starcistacks/production/secrets/`, the `app-be-db` member of `.starcistacks/production/secrets/`, the `test-accounts` member of `.starcistacks/production/secrets/`                                              | cutover scripts only | never reach GitHub                                                                                                                                                                                                    |

Seal or change a value (stdin or `--generate`, never argv): `starci app secret set production api --key OPENCLAW_TOOL_SECRET --generate 32`. List names: `starci app secret list production`. The deploy tooling (`starci app stack deploy`, sops in memory) pipes the decrypted values straight into `docker secret create`; the versioned runtime names are the same whichever decrypt step runs.

### What the be needs (api container environment)

Read from the be config files (`be/src/modules/**/**.config.ts`, `be/apps/api/src/main.ts`). R marks a key the api cannot boot without (it stops with the key name), O an optional key (the capability turns off or a default applies), T a tunable with a literal default. Booleans are `true` or `false`.

Core and database

- `PORT` (R, 8787, set by the stack), `PRIMARY_DB_URL` (R, role `app_be`, sealed), `PRIMARY_DB_SCHEMA` (R, `public`, `api-public.conf`)
- `HTTP_SECURITY_ALLOWED_ORIGINS` (R, `https://nivo.vn,https://www.nivo.vn`, `api-public.conf`)
- `HTTP_SECURITY_RATE_WINDOW`, `HTTP_SECURITY_RATE_DEFAULT_LIMIT`, `HTTP_SECURITY_RATE_STRICT_LIMIT` (T)

Identity, URLs and crypto

- `CHANNEL_TOKEN_KEY` (R; the AES key that seals every connection token; losing it means every connection must be reconnected)
- `SITE_URL` (R; `https://nivo.vn`), `PUBLIC_SITE_URL` (O; `https://nivo.vn`), `PUBLIC_API_URL` (O; `https://api.nivo.vn`). Provider webhook URLs and OAuth callbacks are built from `PUBLIC_API_URL`, falling back to `PUBLIC_SITE_URL`
- `NIVO_PLATFORM_ADMINS` (O, comma list of emails; the platform admins also come from the `platform_admins` table)
- `WORKSPACE_SIGNUP_ENABLED` (T, default false), `INVITE_VALID_DAYS` (T)

Payments and bank feeds

- `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NAME` (O as a group, needed for billing)

Channels and providers

- `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` (O as a group: all or none), `META_GRAPH_VERSION`, `META_LOGIN_CONFIG_ID`, `META_SEND_PER_MINUTE`, `META_TIMEOUT`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (O), `GOOGLE_OAUTH_BASE`, `GOOGLE_SHEETS_BASE`, `GOOGLE_TIMEOUT`
- `ZALO_API_BASE`, `ZALO_OAUTH_BASE`, `ZALO_TIMEOUT`; `TELEGRAM_API_BASE`, `TELEGRAM_TIMEOUT`; `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` (O as a pair, personal Telegram data source); `CHANNEL_SETUP_TIMEOUT`, `CHANNEL_BOT_TOKEN` (O, provisioning cli)
- Per-connection webhook secrets (Telegram, Zalo, Casso, payOS, SePay feed) are generated and stored per connection in the database; there is no global env for them.
- `WEBHOOK_SIGNING_SECRET` (O; the root of the per-workspace signing keys of customer outbound webhooks, the `webhook` member of `.starcistacks/production/secrets/`; absent means webhook signing is unavailable and outbound events are not sent), `WEBHOOK_DELIVERY_TIMEOUT` (T)

Agents, models, automation

- `OPENCLAW_GATEWAY_URL` (set by the stack: `ws://nivo-openclaw:18790`, the loopback relay of the OpenClaw task) plus `OPENCLAW_GATEWAY_TOKEN` or `OPENCLAW_GATEWAY_PASSWORD` (O as a group; without them the chat turn path is "not configured" and answers fall back), `OPENCLAW_TOOL_SECRET` (O, signs the tool bridge), `OPENCLAW_MANAGE_AGENTS` (T, `true` or `false`), `OPENCLAW_TURN_TIMEOUT` (T, duration), `OPENCLAW_SETTLE_DELAY`, `OPENCLAW_CONFIG_DIR`, `OPENCLAW_GATEWAY_STATE_DIR`
- the model provider keys, endpoints and models for the chat, extraction and embedding calls (all O; `be/src/modules/integrations/ai-gateway/ai-gateway-config.policy.ts` lists the names; without a key embeddings and extraction turn off), `AI_JSON_RETRIES`
- `N8N_SIGNING_SECRET` (R), `N8N_WEBHOOK_BASE` (R in the runbook set; `http://nivo-n8n:5678/webhook/nivo-events`), `N8N_ALLOWED_HOSTS`, `N8N_EMIT_TIMEOUT`, `N8N_CONTAINER`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` (O; n8n host control by the CLI; the key and known hosts are the file CONTENT, read through `_FILE`)
- `SMTP_URL`, `SMTP_FROM` (O as a pair), `SMTP_HELLO_NAME`, `SMTP_ALLOW_PRIVATE_HOSTS`; `DATA_ALLOW_PRIVATE_HOSTS`
- `QUEUE_ENABLED`, `QUEUE_CONCURRENCY`, `QUEUE_WORKSPACE_CONCURRENCY`, `QUEUE_RELAY_INTERVAL`, `QUEUE_VISIBILITY_TIMEOUT`, `QUEUE_SHUTDOWN_GRACE`, `JOBS_LEASE`, `JOBS_WORKER_ID` (T)
- `VIDEO_CACHE_DIR`, `VIDEO_WORK_DIR`, `VIDEO_FONTS_DIR`, `VIDEO_FFMPEG_NICE`, `VIDEO_FFMPEG_THREADS`, `VIDEO_MAX_SECONDS`, `VIDEO_TTS_PROVIDER`, `VIDEO_TTS_MIN_GAP_MS` (T); optional `VIDEO_FFMPEG_PATH`, `VIDEO_FFPROBE_PATH` and `VIDEO_NICE_PATH` select trusted operator-installed absolute local executables. Keep the executable and every parent directory unwritable by untrusted users. The API image uses its installed Linux defaults; native installation locations and priority behavior are described in the root README's "Native FFmpeg setup" subsection. PATH is never searched.

Stack settings (the `n8n` and `openclaw` members of `.starcistacks/production/secrets/`, read by the render): the OpenClaw model, `N8N_ALLOWED_HOSTS`, the failed-jobs alert limit (the api sees `JOBS_ALERT_FAILED_MAX`, default 20) and the stale age in seconds (`JOBS_ALERT_STALE_SECONDS`, default 300). The old image, tag and bind-address settings are obsolete: the images are pinned by digest in the stack source.

### What the fe needs (build arguments, public by design)

Every value is a `NEXT_PUBLIC_*` build argument; the web container has no server-side secret.

- the API origin (R; the origin the Apollo client calls: `https://api.nivo.vn`, GraphQL at `/graphql`; the workflow and Dockerfile default to it)
- the developer API origin (R by the Developers page; `https://api.nivo.vn`)
- the public site origin (`https://nivo.vn`)

`fe/apps/web/src/modules/config/index.ts` reads them.

## Owner steps on the day (by hand)

1. **DNS**: the `api.nivo.vn` A record must already exist (section 0). DNS is edited in the Tino panel only (`be/docs/runbooks/dns-rollback.md`); no agent edits it.
2. **platform_admins** are inserted by step 8; the platform admins list in the `api` sealed file also grants the be-side admin routes, the table drives `is_platform_admin()` in RLS.
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
| `GET/POST /api/connections/meta/webhook`            | `https://api.nivo.vn/api/connections/meta/webhook`         | Meta app > Webhooks. Verify token is `META_WEBHOOK_VERIFY_TOKEN`                                             |
| `GET /api/connections/meta/callback`                | `https://api.nivo.vn/api/connections/meta/callback`        | Meta app > Facebook Login > Valid OAuth Redirect URIs                                                        |
| `GET /api/connections/google/callback`              | `https://api.nivo.vn/api/connections/google/callback`      | Google Cloud OAuth client > Authorized redirect URIs                                                         |
| `/api/n8n/data/*`, `/email`, `/runs/:id/complete`   | `https://api.nivo.vn/api/n8n/...`                          | n8n workflows that call back into the api: point their HTTP nodes at the compose-internal address of the api |
| `/api/v1/{messages,events,leads,knowledge,loyalty}` | `https://api.nivo.vn/api/v1/...`                           | The public API customers integrate with (API keys); the Developers page documents the host                   |
| `POST /graphql`                                     | `https://api.nivo.vn/graphql`                              | The fe's Apollo client (the API origin + `/graphql`)                                                         |
| `GET /health/live`, `/healthz`, `/readyz`           | `https://api.nivo.vn/healthz`                              | Monitors (`/health/live` of the product hosts is the web container's)                                        |

Internal only (never public): `/agent-tools/...` (OpenClaw's tool bridge, signed with `OPENCLAW_TOOL_SECRET`, reachable on the docker bridge, not through the edge).

## Docker Swarm cutover window

The VPS runs the previous model as three Compose projects (`nivo-edge` Traefik on 80/443, `nivo-engine` api + openclaw + n8n + n8n-db, `nivo-web`) and a host crontab line (`nivo-engine-watchdog`). The new model is one Swarm stack `nivo` on a single-manager swarm: the same images' successors, **the same named volumes** (`nivo-engine_openclaw-data`, `nivo-engine_n8n-data`, `nivo-engine_video-cache`, `nivo-edge_acme`, so the data and the Let's Encrypt certificates carry over) and no host cron. Canon: the application stacks guide, "Docker Swarm on a VPS"; the stack and the seven runbook commands are in `.starcistacks/production/README.md`.

**One-time owner step: approve `docker swarm init` on the VPS.** Creating a swarm is an effect with its own recovery, so the cutover script (`$C/05a-swarm-prepare.mjs`) runs `starci app stack prepare --env production --init-swarm --owner-approved --execute` only after the owner says yes. It never re-initializes an active swarm. Afterwards: back up `/var/lib/docker/swarm` (`starci app stack backup --env production --swarm-state --execute`) and `sudo install -d -o <deploy user> -m 750 /srv/nivo /srv/nivo/releases` (the release records).

**n8n database change (owner ruling 2026-10-14).** The compose model ran n8n on a Postgres container (`nivo-engine_n8n-db`). The Swarm stack runs n8n on SQLite in the persisted volume `nivo-engine_n8n-data`, so n8n starts with an empty database: re-create the workflows with the repository's n8n sync tool after the first deploy, or export them from the old editor beforehand. The old `nivo-engine_n8n-db` volume is left untouched (it is what the compose rollback uses); remove it only after the cutover is accepted.

How the running compose stack is stopped and replaced (the **Deploy stack** run, which the owner approves as the `production` reviewer, followed by the retire verb):

Before starting that run, the owner signs in to the VPS as the deploy user, runs `crontab -e`, removes only the line containing `nivo-engine-watchdog`, saves, and verifies with `crontab -l` that the line is gone. Keep every unrelated entry. The deploy scripts never read or write host crontabs. Retirement also renames `~/nivo-engine/deploy/watchdog.sh` to `watchdog.sh.retired` before stopping Compose, so a leftover cron entry cannot restart the old model; if that backup already exists alongside an active script, preserve it and retire the active script manually before retrying. Leave the watchdog retired until Compose has restored successfully, then follow the owner's manual watchdog recovery steps in Rollback; monitor the services until those steps are complete. Old workflows run from `pre-lite-cutover` may reinstall it: repeat the manual removal and file retirement after such a redeploy.

1. Build and push the api, web and landing images to GHCR; render the stack with their digests; create the versioned secrets and configs (values piped from SOPS, never printed); store the release record; **pre-pull every image** on the manager. The compose model still serves traffic during all of this.
2. `starci app stack retire --env production --project nivo-web --project nivo-engine --project nivo-edge --execute`: stops the containers of the old compose projects in that order (restart policy off, nothing is removed). Volumes, images and the release folders (the `nivo-edge`, `nivo-engine` and `nivo-web` folders of the deploy user's home) stay. **The public door is down from here.**
3. `docker stack deploy --prune --with-registry-auth`: the stack starts; the ingress binds 80 and 443 and serves the certificates already in `nivo-edge_acme`; the openclaw task starts its relay, the api reaches it as `openclaw:18790`.
4. `starci app stack converge` (desired versus running replicas, no failed task) and `starci app stack verify` (`api.nivo.vn` health and readiness, the GraphQL probe, `nivo.vn` and `www.nivo.vn` `/health/live` for the landing, `app.nivo.vn/health/live` for the console, the 308 from `nivo.vn/login?x=1` to `app.nivo.vn/login?x=1`, OpenClaw by service DNS, the job tooling). Then the release is accepted (the `current` pointer moves).
5. **If the first Swarm release fails**, the owner removes the stack and starts edge, engine and web again from the folders left in place (same volumes and sealed-secret files; the old compose workflows on the tag `pre-lite-cutover` do it). The legacy watchdog remains retired until the owner completes the manual recovery steps in Rollback; monitor the restored services until then. The window then is the time the stack needed to fail plus the compose start.
6. `namnivo-web` (the container of `nguyentuannam.org`, its own repository) must join the attachable overlay network `nivo-edge-swarm` with the alias `namnivo-web`: change its compose file to `networks: {edge: {external: true, name: nivo-edge-swarm, aliases: [namnivo-web]}}`, or once run `docker network connect --alias namnivo-web nivo-edge-swarm <container>`. Until then only that host answers 502.
7. After the owner accepts the cutover, delete the old release folders and images by hand. The compose files are no longer in this branch; the old workflows live on the tag `pre-lite-cutover`.

## Deploy

After the cutover, every release is **Actions > Deploy stack > Run workflow** (`retire_compose` off): build, push, render, create secrets, pre-pull, `docker stack deploy`, converge, verify, accept, prune. The `api`, `web` and `landing` services update start-first with rollback on failure; `ingress`, `openclaw` and `n8n` update stop-first (one owner per host port or volume). A failed update rolls itself back and the workflow deploys the previous accepted release again. Check: `starci app stack doctor --env production`, `docker service logs nivo_api --since 10m` on the manager, `curl -fsS https://api.nivo.vn/healthz` and `/readyz`, and `curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://api.nivo.vn/graphql -H 'content-type: application/json' -d '{"query":"{__typename}"}'` (200 or a 400/401 JSON, never a Next 404 page). Job alerts: the api logs `job-ops.alert.*` events and writes `app_errors` rows; there is no watchdog log.

The fe build: `fe/apps/web/next.config.ts` sets `output: "standalone"`; the Dockerfile copies the standalone output and starts `node fe/apps/web/server.js`. `fe/apps/landing/Dockerfile` similarly builds the standalone landing and starts `node fe/apps/landing/server.js`. Netlify builds nothing after auto publishing is off and the repository has no Netlify config; its last good deploy is the DNS rollback target.

## Verify the system (smoke checklist)

- [ ] **Web health**: the landing answers at `https://nivo.vn/health/live` and `https://www.nivo.vn/health/live`; the console answers at `https://app.nivo.vn/health/live`. `https://nivo.vn/login?x=1` returns 308 with Location `https://app.nivo.vn/login?x=1`.
- [ ] **Login**: sign in at `https://app.nivo.vn/login` with email and password, and with Google. The browser calls `https://api.nivo.vn/graphql` with a bearer token (Network tab: 200, no CORS error). Sign out and in again.
- [ ] **Console**: `/dashboard` and `/agents` render real data (seeds ran), no 401/403 loop.
- [ ] **Chat turn**: send a Telegram test message to a connected bot; it arrives in `/inbox` and the agent answers through OpenClaw (the reply is not `direct_fallback`). `docker service logs nivo_api --since 10m` shows the turn with no repeating error.
- [ ] **Payment webhook**: trigger a SePay delivery with a small real transfer to the account SePay watches; the order in `/billing` becomes paid and the credits appear. A request without the `Authorization: Apikey` header is refused with 401.
- [ ] **Booking**: open the public page `https://app.nivo.vn/b/<slug>` (the old `https://nivo.vn/b/<slug>` redirects there), book a slot; it appears in the workspace's booking list.
- [ ] **Automation tick**: `select public.job_stats();` shows the `automation` and `shifts_alerts` queues moving; `failed24h` stays small; no `job-ops.alert.*` event and no `jobs.alert` row in `app_errors`. `select jobname, command from cron.job` lists the four baseline jobs and the pgmq ticks of the api schedulers, no job calling `net.http_post` or an `engine_*` function.
- [ ] **Agent sync**: after a change in `/agents` the OpenClaw agent `ws-<first 8 characters of the workspace id>-chatbot` reflects it within one interval.
- [ ] **Knowledge**: upload a small document in `/knowledge`; it goes from waiting to `ready`.
- [ ] **Connections**: a Google or Meta authorisation round trip lands back in the app.
- [ ] **Outbound webhooks**: an event for a workspace with a webhook subscription is delivered and signed (`WEBHOOK_SIGNING_SECRET` is set).
- [ ] **Rate limiting** is per client, not per proxy: two different clients both get 200 on a burst that would exceed the limit for one address.
- [ ] n8n events still arrive (`N8N_WEBHOOK_BASE` is the stack-internal URL `http://nivo-n8n:5678/...`).
- Watch for an hour, then enable the nightly backup (`be/docs/runbooks/vps-stack.md`, Backup).

## Rollback

Two cases. **A bad Swarm release after the cutover**: run **Deploy stack** with `operation: rollback` (default: the previous accepted release; its stored stack bytes and secret versions are kept), optionally supplying `release`, or fix forward with `operation: deploy`. From the CLI: `gh workflow run stack-deploy.yml --ref main -f operation=rollback`. **Going back to the old model** (the cutover is called off): remove the stack (`docker stack rm nivo` on the manager) and start the compose projects again from the folders left on the VPS (the watchdog stays retired), or, when those folders are gone, `node $C/08-rollback.mjs --execute --legacy-layers --layer all`, which first removes the stack and then runs the OLD workflows from the tag `pre-lite-cutover` (the old workflows build the old code and recreate the compose projects on the same volumes). Repeat the manual watchdog retirement after an old workflow redeploy. The old web does not call the new api, so each layer can be reverted on its own. The rollback cannot undo a data effect or a schema change.

After a successful Compose restore, the owner restores the legacy watchdog manually. Monitor the restored services until this is complete. Sign in to the VPS as the deploy user. If the watchdog script is absent, rename its `.retired` copy back inside the `nivo-engine/deploy` folder of the deploy user's home (`mv -n` so an existing script is never overwritten), then verify that it is executable (`test -x`). The exact legacy cron line from the cutover restore script (commit 58d85833) is:

```cron
* * * * * <home>/nivo-engine/deploy/watchdog.sh # nivo-engine-watchdog
```

The old installer expanded `<home>` to the deploy user's absolute home directory. Run this owner command on the VPS to print that exact expanded line:

```bash
echo "* * * * * ${HOME}/nivo-engine/deploy/watchdog.sh # nivo-engine-watchdog"
```

Run `crontab -e`, add the printed line once, preserve every unrelated entry, save, and verify it with `crontab -l`. `08-rollback.mjs --to-compose` prints these manual steps; no deploy or rollback script runs them or edits a crontab.

Layers of the old model, for the second case: after the api deploy the old web was still live, after the edge only the `/api/` paths moved, after the web everything moved; roll back in the reverse order:

1. **Web**: the old Deploy web from the tag, or start the previous image still on the host: `ssh vps 'bash ~/nivo-web/remote-deploy.sh "$(cat ~/nivo-web/.tag.prev)"'`.
2. **Edge**: the old Deploy edge from the tag; the old routes send `/api/` back to the web container. Provider dashboards need no change (the URLs never moved).
3. **Engine**: the old Deploy engine from the tag; it rebuilds the engine on the VPS and replaces the `api` container (same compose project, volumes untouched). `~/nivo-engine.prev` holds the previous release if a manual start is quicker. The old engine reads its own dotenv file; the plaintext secret files of the previous release are removed after a healthy deploy, so a rollback after a later deploy goes through a redeploy.
4. **Database**: do not roll the schema back. Migrations are forward-only; if a migration breaks the old code, fix it with a new forward migration (a restore of the nightly dump, `db-runbook.md`, is the last resort).
5. **Secrets**: nothing to undo. Keep the old plaintext custody backup (`C:\Users\Hi\.nivo-lite\_backup-20261003`) until the cutover is accepted; the owner deletes it afterwards.
6. **DNS** (only if the VPS itself is lost): in the Tino panel point the apex A record back at the previous address written down before the cutover (`be/docs/runbooks/dns-rollback.md`); in Netlify use "Publish deploy" on the last pre-cutover deploy.

## After the cutover

- Restore push triggers on the deploy workflows only if you want deploys on merge again.
- Retire the engine vocabulary left in the stack: the Swarm stack keeps using the volumes named `nivo-engine_*` on purpose (they hold the production data; renaming them would orphan it); the sealed keys `ENGINE_*` and the other obsolete keys listed in `.starcistacks/production/README.md` are deleted by the owner.
- Delete the Netlify site and its build hook; delete `C:\Users\Hi\.nivo-lite\_backup-20261003` after every sealed key is verified; revoke the Cloudflare token (the zone was never there).
- Delete the old release folders `~/nivo-edge`, `~/nivo-engine`, `~/nivo-web` and the old compose images on the VPS once the owner accepted the cutover (they are what a compose restore needs until then).
- Update the provider-facing guide only if a public path changed (`be/docs/guides/connecting-channels.md`).
