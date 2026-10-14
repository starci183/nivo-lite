# Cutover: from the engine and Next route handlers to the api

This is the runbook for the day `lite/convert` becomes `main`. Until then production keeps deploying `main` (the engine, the Next route handlers, Netlify as the fallback)
and nothing in the conversion branch deploys by itself: the deploy workflows (`api-deploy.yml`, `edge-deploy.yml`, `web-deploy.yml`, `db-deploy.yml`) have no push trigger and run by hand only.

Nothing here is run by the conversion lanes. Every command below is run by the owner (or the integrator on the owner's word). A short Vietnamese checklist of the owner-only steps is in `D:/starci-tmp/nivo-lite-lanes/CUTOVER-OWNER.md`.

## What lite/convert is now

- **The be is the single API.** One Nest app (`be/apps/api`) serves GraphQL at `/graphql` (contract `be/contracts/api/schema.graphql`), the REST webhooks and OAuth callbacks (`/api/...`), the public v1 API (`/api/v1/...`), the OpenClaw tool bridge, and runs the pgmq jobs and the sagas (schedulers: automation tick, shifts tick, agents sync, decisions drain, content tick, connection health, zalo refresh, data sync). `be/apps/cli` is the operator CLI (`migrate run`, `seed-media upload`, `seed-modules run`).
- **The fe calls the be through Apollo** (`fe/apps/web/src/modules/api/graphql`, the academy pattern: auth and no-auth clients, the Supabase access token attached as the bearer, SWR hooks). The browser keeps Supabase for auth only (sign-in, session, token). There are no Server Actions and no Next route handlers except `/health/live`.
- **The migration history is one baseline.** `supabase/migrations/` holds exactly `20261013142504_lite-baseline.sql` and `20261013142505_lite-baseline-standard.sql`. The 117 older migrations are in `supabase/migrations/_archive/` (they are kept for the one-time history repair below and are never applied to a fresh database).
- **Secrets custody** moves to `.starcistacks/production/secrets/<slug>.enc` (sops + age, owner ruling 2026-10-14). The plaintext `secrets.env` is retired as the custody of record; GitHub environment secrets are fed from the decrypted files.

What changes in production:

| Before                                                                           | After                                                                                                           |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `engine` container in OpenClaw's network namespace (port 8787), built on the VPS | `api` container (`be/apps/api`) in the same place and on the same port, image built on the GitHub runner        |
| webhooks, OAuth callbacks and `/api/*` served by Next route handlers             | the same public paths served by the api; the edge sends every `/api/` path of the product hosts to it           |
| the browser talks to Supabase and to Next server actions                         | the browser talks to Supabase for auth and to `https://api.nivo.vn/graphql` with the user's access token        |
| the service role in Next and in the engine                                       | the service role only in the api (Auth and Storage admin); database access as the least-privilege role `app_be` |
| secrets in `secrets.env`                                                         | secrets in `.starcistacks/production/secrets/*.enc`                                                             |
| Netlify as a hot fallback                                                        | retired (its last good deploy stays available for a DNS rollback)                                               |

## Order and why

Deploy in this order: **database, then api, then edge, then web**, back to back (the whole sequence takes 15 to 20 minutes).

The edge sends `/api/` paths to the api at 8787. If the edge went first, that address would still hold the engine, which answers 404 to every provider webhook (Telegram, Meta, SePay, Casso, payOS) until the api is up; providers retry, but a customer message can be late. With the api first, the old Next handlers keep answering the webhooks until the edge flips them, and after the flip the api answers. The only thing briefly unserved with the api first is the old chat queue (`engine_jobs`, which only the engine consumed): chat turns fall back to the direct processor for the minutes between the api and the web deploy. The new web goes last because it needs `https://api.nivo.vn` (DNS, certificate, CORS) to exist.

## 0. Preconditions (days before)

- [ ] All lanes are merged into `lite/convert`; `starci app check`, `npm run typecheck`, `npm run build:be`, `npm run build:fe` report nothing that blocks the release (the app carries no unit tests on the fe; the be specs ran once under the integrator).
- [ ] The api image builds: `docker build -f be/apps/api/Dockerfile -t nivo-lite/api:dev .` and starts with a real `api.env` (a missing key stops it with the key's name).
- [ ] The web image builds (see "The fe build and Netlify" below): `docker build -f fe/apps/web/Dockerfile -t nivo-lite/web:dev --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... --build-arg NEXT_PUBLIC_API_URL=https://api.nivo.vn .`
- [ ] The hosted Supabase project signs access tokens with an **asymmetric key (ES256)**: it already does (current key ECC P-256, legacy HS256 kept as the previous key). Only check: `curl -fsS "$SUPABASE_URL/auth/v1/.well-known/jwks.json"` lists an EC key. The api verifies tokens against this JWKS and pins ES256.
- [ ] A backup of the database exists (Supabase point-in-time recovery enabled, or `pg_dump` taken now) and its restore is understood.
- [ ] The age identity (`SOPS_AGE_KEY` in the canonical runtime `.claude/secret.env`; there is no key file in the home directory) is backed up outside this machine, and `.starcistacks/production/secrets/` holds the sealed files listed under "Secrets" (`app-be-db.enc` exists; it comes from `lite/final`).
- [ ] DNS: the A record `api.nivo.vn` is added (owner step 1 below). The edge gets its certificate on the first request.
- [ ] Netlify: **stop auto publishing** on the site (Site configuration > Build & deploy) so the merge does not publish a Next build there. Do not delete the site; its last good deploy is a rollback target.
- [ ] Tag the current `main` so every rollback has a fixed point: `git tag pre-lite-cutover origin/main && git push origin pre-lite-cutover` (an owner action).
- [ ] Read `git diff --stat origin/main...lite/convert -- supabase/migrations`: the migrations are forward-only, and the old app must keep working against the new schema until the web is deployed.

## 1. Database

Production recorded the OLD migration versions (origin/main names). The conversion renamed them, re-stamped the ones dated after 2026-10-12 and then replaced the whole history with the baseline. The steps below move production's history onto the baseline without re-running it. The map from old to new versions is `be/docs/runbooks/migration-restamp.md` (the source of truth).

1. Link the CLI to the production project (`supabase link --project-ref <ref>`, or use `db-deploy.yml` with the `production` environment, which carries `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID`).

2. Repair the history: every row of the restamp map whose version changed. Production holds the old version; mark it reverted and mark the new version applied:

   ```bash
   awk -F'|' '$4 ~ /->/ {gsub(/ /,"",$4); split($4,v,"->"); print v[1], v[2]}' be/docs/runbooks/migration-restamp.md |
   while read -r old new; do
     supabase migration repair --status reverted "$old"
     supabase migration repair --status applied "$new"
   done
   supabase migration list      # local (archive names) and remote must agree for every pre-conversion migration
   ```

   Rows where only the name changed need nothing: the version is the key.

3. Apply the migrations the conversion lanes added after origin/main. They live in `supabase/migrations/_archive/` next to the ones production already ran. The archive keeps each migration production already ran under the name it has on `origin/main`; the copy puts every file back under its lite name (the restamp map of step 2), which is the version the repaired history now holds. Push from a scratch project folder so the CLI sees them as migrations:

   ```bash
   mkdir -p ../nivo-archive/supabase/migrations && cp supabase/config.toml ../nivo-archive/supabase/
   for f in supabase/migrations/_archive/*.sql; do
     n=$(basename "$f")
     lite=$(awk -F'|' -v o="$n" '{gsub(/ /,"",$2); gsub(/ /,"",$3)} $2 == o {print $3}' be/docs/runbooks/migration-restamp.md)
     cp "$f" "../nivo-archive/supabase/migrations/${lite:-$n}"
   done
   (cd ../nivo-archive && supabase link --project-ref <ref> && supabase db push --dry-run && supabase db push)
   ```

   Read the dry run: it must list only conversion migrations (the `be-platform` role, `public.queue`, `public.jobs`, the lane migrations), never one that production ran under an old name.

4. Switch the history to the baseline. Production now holds exactly the schema of `20261013142504_lite-baseline.sql`, so that version is marked applied without a run, and the archived versions leave the history:

   ```bash
   for f in ../nivo-archive/supabase/migrations/*.sql; do supabase migration repair --status reverted "$(basename "$f" | cut -d_ -f1)"; done
   supabase migration repair --status applied "$(ls supabase/migrations/*_lite-baseline.sql | xargs -n1 basename | cut -d_ -f1)"
   supabase db push --dry-run    # must list only 20261013142505_lite-baseline-standard.sql (and any later migration)
   supabase db push              # applies lite-baseline-standard
   supabase migration list       # local and remote now both hold exactly the baseline and baseline-standard
   ```

   `lite-baseline-standard` brings the privileges and policy names of a database built by the archived migrations to the baseline's standard (anon holds no table privilege, definer functions are not callable by anon, policies named `<table>_<role>_<action>`, the storage policies recreated under their new names); on a database built from the baseline it changes nothing. The local stack follows the same two steps, or `supabase db reset`.

5. Set the password of the api's database role (never in a migration). The password is generated and sealed in `.starcistacks/production/secrets/app-be-db.enc`. Decrypt it in memory only, never echo it, and never paste it in chat:

   ```bash
   sops -d --input-type dotenv --output-type dotenv .starcistacks/production/secrets/app-be-db.enc | cut -d= -f1    # prints the KEY NAMES only; expect one entry
   APP_BE_PW="$(sops -d --input-type dotenv --output-type dotenv .starcistacks/production/secrets/app-be-db.enc | head -n1 | cut -d= -f2-)"
   printf "alter role app_be password '%s';\n" "$APP_BE_PW" | psql "$ADMIN_DB_URL"        # ADMIN_DB_URL: the postgres/owner connection from the dashboard (Connect panel)
   ```

   Build `PRIMARY_DB_URL` with the **session-mode pooler** from the dashboard's Connect panel (host `aws-0-<region>.pooler.supabase.com`, port **5432**, database `postgres`, user `app_be.<project-ref>`). The api keeps a connection pool, so not the transaction-mode pooler (port 6543). URL-encode the password if it has reserved characters (`node -e "console.log(encodeURIComponent(process.argv[1]))" "$APP_BE_PW"`). Put the finished URL into the sealed `api` secret file (see "Secrets"), then `unset APP_BE_PW`.

6. Check the grants the api needs: connect as `app_be` (`psql "$PRIMARY_DB_URL" -c 'select count(*) from public.queue'`) and call one read of each table family a lane declared. Check that pgmq has its queues: `select * from pgmq.list_queues();` lists the queues of `API_JOB_QUEUES` after the api's first boot (the api creates them; the local stack had none before the baseline).

7. Drain the legacy queues you are about to stop consuming: `select status, count(*) from engine_jobs group by 1;` should show nothing `queued` or `running`, and `select public.job_stats();` should show an empty or small `knowledge` queue.

## 2. Secrets

Custody is `.starcistacks/production/secrets/<slug>.enc`, one sops-encrypted dotenv per concern, with the age recipient set in `.sops.yaml`. Decrypted values live only in memory or under `%LOCALAPPDATA%\StarCi\secrets` (read through the `<KEY>_FILE` convention the be supports). Nothing is written as `.env*`, `secrets.env` or in the repository in plaintext. A `starci app secret` command (canon task k10) will manage these files; until it ships, use sops directly.

The files, and the environment names each holds (names only; the values are never recorded in this repository or in chat):

| Slug (file)                      | Holds                                                                                    | Goes to                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `app-be-db.enc` (exists)         | the generated `app_be` role password                                                     | read once for `alter role` and `PRIMARY_DB_URL`    |
| `api.enc`                        | the runtime environment of the api container (the be list below)                         | GitHub environment secret `API_ENV` (`api.env`)    |
| `web.enc`                        | the fe build values (the fe list below)                                                  | GitHub environment secret `WEB_ENV` and build args |
| `stack.enc`                      | the VPS docker stack: OpenClaw, n8n, binds, watchdog thresholds                          | GitHub environment secret `ENGINE_ENV` (`.env`)    |
| `vps.enc`                        | `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_CI_SSH_KEY`, `VPS_KNOWN_HOSTS`               | deploy workflows                                   |
| `cloudflare.enc` (if still used) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE`                                                | `deploy/stack/dns-rollback.mjs`                    |
| `accounts.enc`                   | `READY_OWNER_EMAIL`, `READY_OWNER_PASSWORD`, `READY_STAFF_EMAIL`, `READY_STAFF_PASSWORD` | smoke accounts of Spa Hoa Mai                      |

Seal a file (the plaintext is typed or piped, never saved; `--filename-override` makes sops use the `.sops.yaml` rule of the target path):

```bash
# edit an existing sealed file in $EDITOR (decrypts to a temp buffer, re-encrypts on save)
sops --input-type dotenv --output-type dotenv .starcistacks/production/secrets/api.enc
# first creation from a piped dotenv
cat plain.env | sops -e --filename-override .starcistacks/production/secrets/api.enc --input-type dotenv --output-type dotenv /dev/stdin > .starcistacks/production/secrets/api.enc
```

Push to GitHub without writing plaintext to disk:

```bash
sops -d --input-type dotenv --output-type dotenv .starcistacks/production/secrets/api.enc   | gh secret set API_ENV    --env production --repo <owner>/nivo-lite
sops -d --input-type dotenv --output-type dotenv .starcistacks/production/secrets/stack.enc | gh secret set ENGINE_ENV --env production --repo <owner>/nivo-lite
sops -d --input-type dotenv --output-type dotenv .starcistacks/production/secrets/web.enc   | gh secret set WEB_ENV    --env production --repo <owner>/nivo-lite
```

`scripts/env-sync.mjs` still reads the old `secrets.env`; do not use it for this cutover (it would re-create the plaintext custody). Also set the GitHub variable `NEXT_PUBLIC_API_URL=https://api.nivo.vn` in the `production` environment. `ENGINE_SHARED_SECRET` is no longer required; leave it until the engine is gone.

### What the be needs (api container environment)

Read from the be config files (`be/src/modules/**/**.config.ts`, `be/apps/api/src/main.ts`) on lite/convert. R = the api stops at boot with the key name when it is missing, O = optional (the capability turns off or a default applies), T = tunable with a literal default.

Core and database

- `PORT` (R, 8787), `PRIMARY_DB_URL` (R, role `app_be`, session pooler), `PRIMARY_DB_SCHEMA` (R, `public`)
- `SUPABASE_URL` (R), `SUPABASE_SERVICE_ROLE_KEY` (R), `SUPABASE_ANON_KEY` (O)
- `HTTP_SECURITY_ALLOWED_ORIGINS` (R, comma list: `https://nivo.vn,https://www.nivo.vn`, plus `https://app-vps.nivo.vn` while it is used)
- `HTTP_SECURITY_RATE_WINDOW`, `HTTP_SECURITY_RATE_DEFAULT_LIMIT`, `HTTP_SECURITY_RATE_STRICT_LIMIT` (T)

Identity, URLs and crypto

- `CHANNEL_TOKEN_KEY` (R; the AES key that seals every connection token; losing it means every connection must be reconnected; the be refuses an undecodable key)
- `SITE_URL` (R by the invites module; the public origin of the web app: `https://nivo.vn`)
- `PUBLIC_SITE_URL` (O; `https://nivo.vn`) and `PUBLIC_API_URL` (O; `https://api.nivo.vn`). Provider webhook URLs and OAuth callbacks are built from `PUBLIC_API_URL`, falling back to `PUBLIC_SITE_URL`
- `NIVO_PLATFORM_ADMINS` (O, comma list of emails; the platform admins also come from the `platform_admins` table)
- `WORKSPACE_SIGNUP_ENABLED` (T, default false), `NIVO_ALLOW_WORKSPACE_SIGNUP` (O, legacy `1`), `INVITE_VALID_DAYS` (T)

Payments and bank feeds

- `SEPAY_WEBHOOK_API_KEY` (O but needed for billing), `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NAME`
- `BANK_WEBHOOK_SECRET` (O; the shared secret of the Vietcombank feed), `TELEGRAM_WORKSPACE_ID` (O; workspace that receives simulated bank credits)
- `SEPAY_SIMULATE_URL` (O, local simulator only)

Channels and providers

- `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` (O as a group: all or none), `META_GRAPH_VERSION`, `META_LOGIN_CONFIG_ID`, `META_SEND_PER_MINUTE`, `META_TIMEOUT`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (O; fall back to `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`), `GOOGLE_OAUTH_BASE`, `GOOGLE_SHEETS_BASE`, `GOOGLE_TIMEOUT`
- `ZALO_API_BASE`, `ZALO_OAUTH_BASE`, `ZALO_TIMEOUT`; `TELEGRAM_API_BASE`, `TELEGRAM_TIMEOUT`; `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` (O as a pair, personal Telegram data source); `CHANNEL_SETUP_TIMEOUT`, `CHANNEL_BOT_TOKEN` (O, provisioning cli)
- Per-connection webhook secrets (Telegram, Zalo, Casso, payOS, SePay feed) are generated and stored per connection in the database; there is no global env for them. The per-provider `<PROVIDER>_WEBHOOK_SECRET` / `_TOLERANCE` pattern is wired in `main.ts` but no provider uses it yet.
- `WEBHOOK_DELIVERY_TIMEOUT` (T), `ENGINE_SHARED_SECRET` (O, legacy)

Agents, models, automation

- `OPENCLAW_GATEWAY_URL` plus `OPENCLAW_GATEWAY_TOKEN` or `OPENCLAW_GATEWAY_PASSWORD` (O as a group; without them the chat turn path is "not configured" and answers fall back), `OPENCLAW_TOOL_SECRET` (O, signs the tool bridge), `OPENCLAW_MANAGE_AGENTS` (T), `OPENCLAW_TURN_TIMEOUT`, `OPENCLAW_SETTLE_DELAY`, `OPENCLAW_CONFIG_DIR`, `OPENCLAW_GATEWAY_STATE_DIR`
- `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_API_KEY`, `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL` (all O; without a key embeddings and extraction turn off), `AI_JSON_RETRIES`
- `N8N_SIGNING_SECRET` (R), `N8N_WEBHOOK_BASE` (O; the compose-internal URL, `http://n8n:5678/webhook/nivo-events`), `N8N_ALLOWED_HOSTS`, `N8N_EMIT_TIMEOUT`, `N8N_CONTAINER`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` (O; n8n host control)
- `SMTP_URL`, `SMTP_FROM` (O as a pair), `SMTP_HELLO_NAME`, `SMTP_ALLOW_PRIVATE_HOSTS`; `DATA_ALLOW_PRIVATE_HOSTS`
- `QUEUE_ENABLED`, `QUEUE_CONCURRENCY`, `QUEUE_WORKSPACE_CONCURRENCY`, `QUEUE_POLL_INTERVAL`, `QUEUE_VISIBILITY_TIMEOUT`, `QUEUE_SHUTDOWN_GRACE`, `JOBS_LEASE`, `JOBS_WORKER_ID` (T)
- `VIDEO_CACHE_DIR`, `VIDEO_WORK_DIR`, `VIDEO_FONTS_DIR`, `VIDEO_FFMPEG_NICE`, `VIDEO_FFMPEG_THREADS`, `VIDEO_MAX_SECONDS`, `VIDEO_TTS_PROVIDER`, `VIDEO_TTS_MIN_GAP_MS` (T)

Stack env (`stack.enc`, the compose `.env`, not read by the be): `OPENCLAW_IMAGE`, `OPENCLAW_TAG`, `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_MODEL`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `N8N_TAG`, `N8N_ENCRYPTION_KEY`, `N8N_DB_PASSWORD`, `N8N_ALLOWED_HOSTS`, `N8N_BIND`, `API_BIND`, `N8N_HOST`, `N8N_PROTOCOL`, `N8N_WEBHOOK_URL`, `N8N_SECURE_COOKIE`, `JOBS_FAILED_ALERT`, `JOBS_STALE_SECONDS`, `API_TAG`.

Note: `.starcistacks/production/README.md` still lists a few names the code no longer reads (`N8N_DEFAULT_WEBHOOK_URL`, `OPENCLAW_TURN_TIMEOUT_MS`, `QUEUE_RELAY_*`) and misses `SITE_URL`, `PUBLIC_SITE_URL`, `PUBLIC_API_URL`, `N8N_SIGNING_SECRET`, `N8N_WEBHOOK_BASE`. Use the lists above; the README template is corrected in the same commit as this runbook.

### What the fe needs (build arguments, public by design)

Every value is a `NEXT_PUBLIC_*` build argument; the web container has no server-side secret.

- `NEXT_PUBLIC_SUPABASE_URL` (R), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (R)
- `NEXT_PUBLIC_API_URL` (R; the origin the Apollo client calls: `https://api.nivo.vn`, GraphQL at `/graphql`)
- `NEXT_PUBLIC_DEVELOPER_API_URL` (R by the Developers page; `https://api.nivo.vn`)
- `NEXT_PUBLIC_SITE_URL` (O; `https://nivo.vn`), `NIVO_CONTACT_URL` (O)
- `NEXT_PUBLIC_DEMO_LOGIN` (O), `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`, `NEXT_PUBLIC_GOOGLE_APP_ID` (O; Google Picker)

The Dockerfile and `web-deploy.yml` pass `NEXT_PUBLIC_API_URL` (default `https://api.nivo.vn`) as a build argument; `modules/config` requires it.

Local development reads `fe/apps/web/.env.local` values (public values only) and `be` reads its environment through `<KEY>_FILE` from `%LOCALAPPDATA%\StarCi\secrets`; neither is committed.

## 3. Owner steps (by hand, in this order)

1. **DNS**: `api.nivo.vn` -> the VPS (A record, DNS only, TTL 60; the VPS address is `103.142.27.9` in `dns-rollback.md`; confirm it is still current). The DNS configuration of `nivo.vn` lives in the nivo backend, encrypted: the owner edits it there (`sops <the encrypted dns config>`) and applies it; no agent edits it. Verify: `nslookup api.nivo.vn`.
2. **Supabase Auth redirect allow-list** (Dashboard > Authentication > URL Configuration): Site URL `https://nivo.vn`; Redirect URLs `https://nivo.vn/**`, `https://www.nivo.vn/**`, `https://app-vps.nivo.vn/**`, and for local development `http://localhost:3000/**` and `http://127.0.0.1:3000/**` (the local fe uses next's default port 3000; port 3100 is gone). Keep the Google provider's callback `https://<ref>.supabase.co/auth/v1/callback`.
3. **platform_admins rows** (the platform team; the table is keyed by lower-case email). In the SQL editor:

   ```sql
   insert into public.platform_admins (email) values ('<admin1@example.com>'), ('<admin2@example.com>') on conflict do nothing;
   ```

   Setting `NIVO_PLATFORM_ADMINS` in `api.enc` also grants the be-side admin routes; the table drives `is_platform_admin()` in RLS.

4. **Env names to set in the sealed files**: `CHANNEL_TOKEN_KEY` (copy the existing production value; do NOT generate a new one, or every stored connection token becomes unreadable), `SITE_URL=https://nivo.vn`, `PUBLIC_API_URL=https://api.nivo.vn` (and `PUBLIC_SITE_URL=https://nivo.vn`).
5. **Provider webhooks and callbacks** (after the api and edge are live; table below).
6. **Seed data** from the cli image or the built workspace, with `api.env` loaded (`PRIMARY_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):

   ```bash
   docker run --rm --env-file api.env nivo-lite/cli:dev seed-media upload     # music beds of be/src/assets/media-seed into the media bucket (music/<track>.mp3)
   docker run --rm --env-file api.env nivo-lite/cli:dev seed-modules run      # upserts the module catalogue and authority actions; deletes nothing
   # or from a built checkout: npm run cli -- seed-media upload ; npm run cli -- seed-modules run
   ```

   Run `seed-modules run` before the first smoke test: the agents page is empty without the catalogue.

### Provider webhook URLs

The edge keeps forwarding every `/api/` path of `nivo.vn`, `www.nivo.vn` and `app-vps.nivo.vn` to the api, so the URLs providers already hold (`https://nivo.vn/api/...`) keep working. The new canonical host is `https://api.nivo.vn` (same paths, no prefix). The be builds the URL it shows and registers from `PUBLIC_API_URL`. Per-connection URLs are shown on the connection's page and are registered automatically for Telegram and Zalo when the connection is (re)saved; the others are pasted into the provider's dashboard.

| Route (be)                                          | New URL                                                    | Provider and what to change                                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/telegram/:connectionId`                  | `https://api.nivo.vn/api/telegram/<connectionId>`          | Telegram `setWebhook` (header `x-telegram-bot-api-secret-token`). Re-save the connection or run `setWebhook`; check `getWebhookInfo` has no `last_error_message`.    |
| `POST /api/connections/zalo/:connectionId`          | `https://api.nivo.vn/api/connections/zalo/<connectionId>`  | Zalo OA webhook in the Zalo developer console; re-authorise the OA if the callback host is validated.                                                                |
| `POST /api/connections/casso/:connectionId`         | `https://api.nivo.vn/api/connections/casso/<connectionId>` | Casso webhook (signature header `x-casso-signature`).                                                                                                                |
| `POST /api/connections/payos/:connectionId`         | `https://api.nivo.vn/api/connections/payos/<connectionId>` | payOS webhook URL in the payOS dashboard.                                                                                                                            |
| `POST /api/connections/sepay/:connectionId`         | `https://api.nivo.vn/api/connections/sepay/<connectionId>` | SePay webhook of a workspace's bank feed (`Authorization: Apikey <key>`, the key generated for the connection).                                                      |
| `POST /api/sepay/webhook`                           | `https://api.nivo.vn/api/sepay/webhook`                    | SePay webhook of the platform's own account (billing); `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`.                                                              |
| `POST /api/bank/vietcombank`                        | `https://api.nivo.vn/api/bank/vietcombank`                 | The Vietcombank forwarder (header `x-nivo-bank-secret` = `BANK_WEBHOOK_SECRET`).                                                                                     |
| `GET/POST /api/connections/meta/webhook`            | `https://api.nivo.vn/api/connections/meta/webhook`         | Meta app > Webhooks (Facebook Page and Instagram). One webhook for the whole app. Verify token = `META_WEBHOOK_VERIFY_TOKEN`.                                        |
| `GET /api/connections/meta/callback`                | `https://api.nivo.vn/api/connections/meta/callback`        | Meta app > Facebook Login > Valid OAuth Redirect URIs. **Required**: the be sends this exact redirect URI once `PUBLIC_API_URL` is set.                              |
| `GET /api/connections/google/callback`              | `https://api.nivo.vn/api/connections/google/callback`      | Google Cloud OAuth client > Authorized redirect URIs. **Required** for the same reason (Drive and Sheets connections).                                               |
| `/api/n8n/data/*`, `/email`, `/runs/:id/complete`   | `https://api.nivo.vn/api/n8n/...`                          | n8n workflows that call back into the api: point their HTTP nodes at the compose-internal address of the api or at the new host.                                     |
| `/api/v1/{messages,events,leads,knowledge,loyalty}` | `https://api.nivo.vn/api/v1/...`                           | The public API customers integrate with (API keys); the old `https://nivo.vn/api/v1/...` keeps working through the edge. The Developers page documents the new host. |
| `POST /graphql`                                     | `https://api.nivo.vn/graphql`                              | The fe's Apollo client (`NEXT_PUBLIC_API_URL` + `/graphql`).                                                                                                         |
| `GET /health/live`, `/healthz`, `/readyz`           | `https://api.nivo.vn/health/live`                          | Monitors; `engine.nivo.vn/healthz` stays as the legacy health host.                                                                                                  |

Internal only (never public): `/agent-tools/...` (OpenClaw's tool bridge, signed with `OPENCLAW_TOOL_SECRET`, reachable on the docker bridge, not through the edge).

## 4. Merge

Merge `lite/convert` into `main` (owner action). Nothing deploys: the deploy workflows are manual, `images.yml` and `ci.yml` run on tags and by hand. Confirm in the Actions tab that no run started.

## 5. Deploy the api

Actions > **Deploy api** > Run workflow (branch `main`). It builds the image, ships it, swaps the release folder, replaces the `engine` container with `api` (`--remove-orphans`), waits for `healthy` and `/readyz`, and restores the previous release when that fails.

Verify on the VPS and from outside:

```bash
ssh vps 'cd ~/nivo-engine/deploy && docker compose --env-file .env ps && docker compose --env-file .env logs --tail 50 api'
ssh vps "docker exec nivo-engine-api-1 node -e \"fetch('http://127.0.0.1:'+process.env.PORT+'/readyz').then(r=>console.log(r.status))\""
curl -fsS https://engine.nivo.vn/healthz        # the legacy health host now answers from the api (the edge already routes it to 8787)
```

The watchdog line in the `nivo` crontab is rewritten by the workflow; `~/nivo-engine/watchdog.log` should show no `ALERT`. Then run the seeds (owner step 6).

## 6. Deploy the edge

Actions > **Deploy edge** > Run workflow. Traefik reloads the routes: `api.nivo.vn` and every `/api/` path of `nivo.vn`, `www.nivo.vn` and `app-vps.nivo.vn` go to the api; everything else still goes to the web container.

```bash
curl -fsS https://api.nivo.vn/health/live
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://api.nivo.vn/graphql -H 'content-type: application/json' -d '{"query":"{__typename}"}'   # 200 (or 400/401 JSON), never a Next 404 page
curl -sS -o /dev/null -w '%{http_code}\n' https://nivo.vn/api/v1/events      # 401 or 405 from the api (JSON), not a Next 404 page
```

Then do owner step 5 (provider URLs). Spot-check Telegram: `curl -s "https://api.telegram.org/bot<token>/getWebhookInfo"` shows no `last_error_message` and `pending_update_count` falling to 0.

## 7. Deploy the web

Actions > **Deploy web** > Run workflow. It builds `fe/apps/web/Dockerfile` from the repository root, ships the image, starts it as `nivo-web:<sha>`, and rolls back to the previous tag when the container is not healthy. Use the docker path for the web (next section).

## 8. The fe build and Netlify

`fe/apps/web/next.config.ts` now sets `output: "standalone"` unconditionally (it used to depend on `NEXT_OUTPUT=standalone`, which only the Dockerfile set). The repository has no `netlify.toml` any more and no `@netlify/*` package.

- **Docker (the production path, no change needed):** the Dockerfile builds with `turbo run build --filter=@nivo-lite/web` and copies `.next/standalone` to the runtime stage, starting `node fe/apps/web/server.js`. Unconditional standalone is exactly what it expects. Before the cutover, run the docker build once (precondition 0) and start the image: `docker run --rm -p 3000:3000 nivo-lite/web:dev`, then `curl -fsS localhost:3000/health/live`.
- **Netlify:** whether Netlify's Next.js runtime deploys a `standalone` build was **not verified** here (nothing may be deployed from this lane, and the dependency is not installed). Netlify's runtime builds its own server bundle from `.next` and is documented to ignore or tolerate the setting, but treat that as unconfirmed. The plan does not need it: Netlify is retired for builds (auto publishing stopped, no `netlify.toml`), and only its last pre-cutover deploy is kept for a DNS rollback.
- **If Netlify must build the new fe anyway** (not planned): add a `netlify.toml` with `[build] command = "npm run build:fe"`, `publish = "fe/apps/web/.next"`, the `@netlify/plugin-nextjs` plugin, and the same `NEXT_PUBLIC_*` variables in the site settings, run a **deploy preview** on a branch, and check `/health/live`, a sign-in and one GraphQL call before it ever serves production. If the preview fails on the standalone output, make `output` conditional again on an env var that only the Dockerfile sets (`NEXT_OUTPUT=standalone`).
- Small follow-ups for the integrator: point the Dockerfile `HEALTHCHECK` at `/health/live` (it probes `/login`), pin `outputFileTracingRoot` in `next.config.ts` to the repository root so the `fe/apps/web/server.js` layout does not depend on workspace auto-detection.

## 9. Verify the system (smoke checklist)

Run these after the web is up. Each line says what a pass looks like.

- [ ] **Login**: sign in at `https://nivo.vn/login` with email and password, and with Google. The browser calls `https://api.nivo.vn/graphql` with a bearer token (Network tab: 200, no CORS error). Sign out and in again.
- [ ] **Console**: `/dashboard` and `/agents` render real data (seeds ran), no 401/403 loop.
- [ ] **Chat turn**: send a Telegram test message to a connected bot; it arrives in `/inbox` and the agent answers through OpenClaw (the reply is not `direct_fallback`). `docker compose --env-file .env logs --since 10m api` shows the turn with no repeating error.
- [ ] **Payment webhook**: trigger a SePay delivery (a small real transfer to the platform account, or the SePay simulator against `https://api.nivo.vn/api/sepay/webhook`); the order in `/billing` becomes paid and the credits appear. A request without the `Authorization: Apikey` header is refused with 401.
- [ ] **Booking**: open the public page `https://nivo.vn/b/<slug>`, book a slot; it appears in the workspace's booking list, and a status change goes through `booking-status`.
- [ ] **Automation tick**: `select public.job_stats();` shows the `automation` queue moving (the scheduler enqueues every 60 s) and the `shifts_alerts` queue likewise; `failed24h` stays small; no `ALERT` in `~/nivo-engine/watchdog.log`.
- [ ] **Agent sync**: the `agents` scheduler (every 5 minutes) runs: after a change in `/agents` the OpenClaw agent `ws-<first 8 characters of the workspace id>-chatbot` reflects it within one interval (`logs api` shows the agents job completing).
- [ ] **Knowledge**: upload a small document in `/knowledge`; it goes from waiting to `ready`.
- [ ] **Connections**: a Google or Meta authorisation round trip lands back in the app (confirms owner step 5 redirect URIs).
- [ ] **Rate limiting** is per client, not per proxy: two different clients both get 200 on a burst that would exceed the limit for one address.
- [ ] n8n events still arrive (`N8N_WEBHOOK_BASE` is the compose-internal URL).
- Watch for an hour, then enable the nightly backup (`be/docs/runbooks/vps-stack.md`, Backup).

## Rollback

Decide quickly: after step 5 the old web is still live, after step 6 only the `/api/` paths moved, after step 7 everything moved. Roll back in the reverse order. Every rollback runs the OLD workflow from the tag `pre-lite-cutover` (Run workflow > "Use workflow from" > tag), because the old workflows build the old code. The old web does not call the new api, so each layer can be reverted on its own.

1. **Web**: Run **Deploy web** from the tag `pre-lite-cutover` (rebuilds the pre-conversion image), or start the previous image that is still on the host: `ssh vps 'bash ~/nivo-web/remote-deploy.sh "$(cat ~/nivo-web/.tag.prev)"'`.
2. **Edge**: Run **Deploy edge** from the tag; the old routes send `/api/` back to the web container and keep `engine.nivo.vn/healthz` on the engine. Provider dashboards edited in owner step 5 can stay: the old URLs `https://nivo.vn/api/...` are the ones the old web answers; if you pointed a provider at `api.nivo.vn`, point it back (Meta and Google redirect URIs can hold both hosts, so add rather than replace them).
3. **Engine**: Run **Deploy engine** from the tag. It rebuilds the engine on the VPS and replaces the `api` container (the stack project is the same, so the volumes are untouched). `~/nivo-engine.prev` holds the previous release folder if a manual start is quicker.
4. **Database**: do not roll the schema back. Migrations are forward-only and the old code is expected to run against the new schema; if a specific migration breaks the old code, fix it with a new forward migration, from the backup of precondition 0 only as the last resort. The old web and engine do not read `supabase_migrations`, so they run on the baseline history as it is. Return the history to the old file names only if you must run the OLD `db-deploy.yml` from the tag:

   ```bash
   supabase migration repair --status reverted 20261013142504 20261013142505
   for f in ../nivo-archive/supabase/migrations/*.sql; do supabase migration repair --status applied "$(basename "$f" | cut -d_ -f1)"; done   # the state after step 3
   # then the loop of step 2 with reverted on the new version and applied on the old one
   ```

   `app_be` and its password stay; they are harmless to the old code.

5. **Secrets**: the GitHub environment secrets set from the sealed files are additive (`API_ENV`, `WEB_ENV`, `ENGINE_ENV`); the old workflows read their own. Nothing to undo. Keep `secrets.env` until the cutover is accepted.
6. **DNS** (only if the VPS itself is lost): `node scripts/with-secrets.mjs node deploy/stack/dns-rollback.mjs` puts the apex back on Netlify (`be/docs/runbooks/dns-rollback.md`); in Netlify use "Publish deploy" on the last pre-cutover deploy, because the site builds nothing after auto publishing was stopped. `api.nivo.vn` can stay; it only matters to the new web.

## After the cutover

- Restore push triggers on the deploy workflows only if you want deploys on merge again (they were removed so the conversion deploys nothing by itself).
- Retire the engine: its source left the tree with the lite cleanup (the `pre-lite-cutover` tag keeps it). Once nothing consumes `engine_jobs` and a week has passed, delete the secret `ENGINE_SHARED_SECRET` and the `engine_*` rows and RPCs in a forward migration.
- Retire Netlify: delete the Netlify site and its build hook (`netlify.toml` is already gone from the tree).
- Remove the `[engine]` alias block from the old `secrets.env`, then delete `secrets.env` itself once the sealed files are accepted, and drop `ENGINE_BIND` from the stack env once `API_BIND` is set.
- Update the provider-facing guide only if a public path changed (`be/docs/guides/connecting-channels.md`).

## Known gaps handed to the integrator

- The Dockerfile health check still probes `/login`; `outputFileTracingRoot` is not pinned.
- The be falls back to `http://localhost:3100` as the dev site origin when `SITE_URL` is unset (`connection-url.policy.ts`, `connections.service.ts`, `zalo-credentials.service.ts` and their specs); move it to 3000 with the next be change (set `SITE_URL=http://localhost:3000` locally meanwhile).
- The root `package.json` has `docker:build:api` and `docker:build:cli` but no `docker:build:web` (a managed script block; `starci app sync` owns it).
- Operator scripts `deploy/stack/jobs.sh` and the job check in `watchdog.sh` read `job_stats()` and `job_outbox`; repoint them to the cli commands of the queue lane once those exist.
- `scripts/env-sync.mjs` and `scripts/set-secrets.ps1` still implement the plaintext `secrets.env` custody; replace them with `starci app secret` when the canon ships it.
- `fe/apps/web/next.config.ts` still configures `serverActions.bodySizeLimit`, although the fe has no Server Actions; remove it with the next fe config change.
