# production

The production environment of NIVO: **Docker Swarm on one Ubuntu VPS** (a single-manager swarm: orchestration without manager failover; a lost manager needs recovery or a replacement), with the database self-hosted in the stack as `nivo-postgres` (owner ruling 2026-10-29; the Supabase Cloud project is locked and retired at cutover). Components: `ingress` (the shared Traefik of the VPS), `landing` (`nivo.vn` / `www.nivo.vn`), `web` (console on `app.nivo.vn`), `api` (`api.nivo.vn`), `mcp` (the internal MCP gateway, no public host), `openclaw` and `n8n` (SQLite on the persisted volume `nivo-engine_n8n-data`; there is no self-hosted Postgres). The application stack publishes no port: the shared ingress owns 80 and 443 and the certificates. The zone `nivo.vn` is at Tino. The Swarm services carry the tenant-unique names `nivo-api`, `nivo-mcp`, `nivo-web-app`, `nivo-landing`, `nivo-openclaw` and `nivo-n8n` (full names `nivo_nivo-api` and so on), so no short alias such as `api` exists on the shared edge network; the edge aliases `nivo-api`, `nivo-web-swarm`, `nivo-landing` and `nivo-n8n` are unchanged. The stack source is `.starcistacks/production/infra/swarm/stack.yaml`; every deploy step is a verb of `starci app stack`, configured by `environments.production.deploy` of `.starcistacks/application-stacks.yaml`, and the release itself is the **deploy stack** workflow (`.github/workflows/stack-deploy.yml`). There is no compose project, no host crontab and no application script on the VPS.

## The seven commands

All commands run at the app root of an owner machine that holds the age identity (the `ops`, `vps-ssh-key` and `vps-known-hosts` members give the verbs their SSH session), or on the VPS manager. Effectful verbs are a dry run without `--execute`.

| Command | What it does |
| --- | --- |
| prepare | `starci app stack prepare --env production --execute`: host checks without effect (Ubuntu and Docker versions, linux/amd64, disk, ports, Swarm state, the external volumes), then creates the four external volumes a fresh host lacks (`nivo-engine_openclaw-data`, `nivo-engine_video-cache`, `nivo-engine_n8n-data`, `nivo-engine_ai-router-data`, `nivo-edge_acme`). `--init-swarm --owner-approved --execute` runs `docker swarm init` once, only after the owner approved it; an active swarm is never re-initialized. One-time host setup: `sudo install -d -o <deploy user> -m 750 /srv/nivo /srv/nivo/releases`. |
| doctor | `starci app stack doctor --env production`: the same checks plus services, replicas, images, the managed secret and config counts and the release pointers; changes nothing. |
| up | Actions > **deploy stack** > Run workflow from the release tag (`operation: deploy`, environment `production`, reviewers approve). It builds and pushes the api, web and landing images to GHCR, then runs `starci app stack deploy`: render with digests, create the versioned secrets and configs, store the release record, pre-pull, `docker stack deploy --prune --with-registry-auth`, observe convergence, verify, accept and prune. A dry run is `starci app stack render --env production --image <service>=<repository>@sha256:<digest> --source-sha <sha>`. |
| status | `starci app stack converge --env production --since <ISO time>` (desired versus running replicas, update state, no failed or rejected task) and `starci app stack doctor --env production`; on the manager `docker stack ps nivo --no-trunc` lists tasks with their errors. |
| logs | On the manager: `docker service logs --tail 200 nivo_<nivo-api\|nivo-mcp\|nivo-web-app\|nivo-landing\|nivo-openclaw\|nivo-n8n>`. Job tooling: `starci app stack jobs stats\|failed\|open\|retry\|retry-failed --env production` (it runs the `jobs` CLI group inside the running api task). The n8n editor and the OpenClaw Control UI are private: on the manager run a loopback-only relay, for example `docker run --rm --name nivo-tunnel-n8n --network nivo_automation -p 127.0.0.1:5678:5678 alpine/socat TCP-LISTEN:5678,fork,reuseaddr TCP:nivo-n8n:5678` (network `nivo_agents`, host `nivo-openclaw`, port 18790 for OpenClaw), then `ssh -L` from your machine. |
| down | On the manager `docker stack rm nivo`: the services go; the volumes, secrets and configs stay. To go back to the previous accepted release use the **deploy stack** workflow with `operation: rollback` (or `starci app stack rollback --env production --execute`). |
| verification | `starci app stack verify --env production`: `api.nivo.vn` `/healthz`, `/readyz` and a GraphQL `{__typename}`, `nivo.vn` and `www.nivo.vn` `/health/live` (landing), `app.nivo.vn/health/live` (console), the legacy `nivo.vn/healthz` path, and `jobs watchdog` printing exactly two integers inside the api task. `deploy` runs it before acceptance; the manual smoke list is `be/docs/runbooks/cutover.md`, "Verify the system". |

## Owner actions (the only ones)

1. **DNS at Tino**: A records `nivo.vn`, `www.nivo.vn`, `app.nivo.vn` and `api.nivo.vn` pointing at the VPS (`103.142.27.9`). Nothing scripts DNS; receipt: `nslookup api.nivo.vn 1.1.1.1`. The ingress cannot obtain a certificate before this.
2. **Approve `docker swarm init` on the VPS, once** (already done on the live host). Creating a swarm is an effect with its own recovery: afterwards back up the Swarm state (`starci app stack backup --env production --swarm-state --execute`) and decide on autolock before adding nodes.
3. **GitHub environment `production`**: secrets `SOPS_AGE_KEY`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`; variables `VPS_HOST`, `VPS_USER`; required reviewers. The age identity stays backed up in the owner's untracked runtime secret file: losing it loses every sealed secret.
4. **Packages**: the GHCR packages `nivo-lite-api`, `nivo-lite-mcp`, `nivo-lite-web` and `nivo-lite-landing` are created private by the first run; keep them linked to the repository.
5. **Database deploy**: the `db-deploy` workflow is retired with Supabase (its SUPABASE_* keys are dropped), and needs a tracked backup receipt path as its input.

## Custody

Secrets are kept ONLY as sops-encrypted YAML members, one per provider, `.starcistacks/production/secrets/<provider>.enc.yaml` (map in SECRETS-PLAN.md). The age recipient is in `.sops.yaml`; the age identity is `SOPS_AGE_KEY` in the owner's untracked runtime secret file and in the GitHub environment secret of the same name. No root dotenv file, no plaintext secrets file and no secrets directory exists, and none may be created.

- Read or change a value: `starci app secret list|get|set production <slug>` (values travel through stdin and memory only; `list` prints names).
- A release decrypts the members **in memory on the runner** and pipes each granted key into `docker secret create nivo-<key>-v<keyed hash> -` on the manager over the pinned ssh session (`starci app stack deploy`). The version is the first 10 hex of an HMAC of the key name and value under the age identity: a changed value is a new name; an unchanged one keeps its name, so a deploy restarts only what changed. The rendered stack keeps `{external: true, name: <runtimeName>}` and no value. The logical-name to runtime-name map is the `secrets` list of each release record (names only).
- Services read `/run/secrets/<KEY>` through `<KEY>_FILE`. OpenClaw has no `_FILE` support: its entrypoint wrapper (`.starcistacks/production/infra/swarm/openclaw/entrypoint.sh`) exports the gateway token and the provider keys from `/run/secrets` into the gateway process only.
- Rotation: `starci app secret set production <slug> <KEY>`, commit, run the **deploy stack** workflow. The new name is created and granted, convergence is observed, and only then does the prune step remove names that neither the accepted nor the previous release uses. A name is never reused.
- The connection key `CHANNEL_TOKEN_KEY` is the exception: one random 32-byte key, set once and never overwritten or rotated, because it seals every stored credential Its custody is guarded where it is used: the api and the mcp app open a credential already sealed in the database before they serve, and a key that was overwritten under stored credentials stops them with the connection-secrets key-mismatch error, so a replaced key never goes live. A per-request failure to open a credential is logged as an error and refused, never sent.
- The stack file declares one external stub per sealed member (`nivo-custody-<slug>-v1`) as the custody record the stack checks read; no service is granted a stub and no such Swarm secret exists.
- Local development uses the local Supabase stack and exported shell values, not these files.

## Two secret zones

- **App and platform secrets** stay sealed in this custody and are loaded at deploy: everything the api, the mcp app (the MCP
  gateway itself) or the platform needs whatever the tenants, with zero workspaces: the database connection, service-to-service
  keys, the gateway's own auth and the connection key `CHANNEL_TOKEN_KEY`. They are never moved to the database.
- **Workspace (tenant) secrets** are sealed in the database per workspace with the connection key and entered in the console: a
  channel connection's tokens and a remote MCP connector's credential (for example the HAKUEN connector's client secret). They are
  never deployment keys and never listed here.

## Sealed members (names only, values are never written down)

The key roster with semantics is `.starcistacks/production/runtime/env/KEYS.md`.

| Slug | Consumer | Keys |
| --- | --- | --- |
| `nivo` | api task (`<KEY>_FILE`); mcp task (`CHANNEL_TOKEN_KEY` only) | `CHANNEL_TOKEN_KEY`, `OTP_PEPPER`, `WEBHOOK_SIGNING_SECRET`, `NIVO_PLATFORM_ADMINS`. Remote MCP connector credentials are not custody keys: they are sealed per workspace in the database from the console |
| `smtp` | api task | `SMTP_URL`, `SMTP_FROM` |
| `sepay` | api task | `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NAME` |
| `openrouter` | api task | `OPENROUTER_API_KEY` |
| `auth` | api task | `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY` (the own Passport signing pair) |
| `google` | api task | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (own Google sign-in) |
| `storage` | api task | `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` (the MinIO service account; `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_URL` and `STORAGE_BUCKET_PREFIX` are public configuration in `api-public.conf`) |
| `ai` | api task | `AI_ROUTER_ADMIN_TOKEN`, `AI_API_KEY` |
| `n8n` | n8n, api | `N8N_ENCRYPTION_KEY` (n8n), `N8N_SIGNING_SECRET` (also granted to the api); configuration read at render time (not a Swarm secret): `N8N_ALLOWED_HOSTS`, `N8N_PROTOCOL`, `N8N_SECURE_COOKIE` |
| `openclaw` | openclaw, api | secrets: `OPENCLAW_GATEWAY_TOKEN` (also granted to the api), `OPENCLAW_AI_KEY` (the gateway virtual key of openclaw); `OPENCLAW_MANAGE_AGENTS` (`true` or `false`, granted to the api), `OPENCLAW_TURN_TIMEOUT`; configuration read at render time: `OPENCLAW_MODEL` |
| `redis` | `nivo-redis`, api task | `QUEUE_REDIS_PASSWORD` |
| `postgres` | `nivo-postgres` (`POSTGRES_PASSWORD_FILE`), `nivo-postgres-backup`; api task; operator | `POSTGRES_PASSWORD` (superuser), `APP_BE_DB_PASSWORD` (the `app_be` login role), `PRIMARY_DB_URL` |
| `vps` | operator verbs | `VPS_HOST`, `VPS_USER` (never granted) |
| `web` | web image build | the public build values of the console (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` and their siblings, never sealed) read by `starci app stack build-args` |
| `test-accounts` | smoke tests | `READY_OWNER_*`, `READY_STAFF_*`, `DEMO_*` |
| `ci-ssh-key`, `vps-ssh-key`, `vps-known-hosts` | JSON envelopes of the deploy SSH material | one key each |

The non-secret production configuration (`PRIMARY_DB_SCHEMA`, `AUTH_WEB_ORIGIN`, `AUTH_GOOGLE_CALLBACK_URL`, `STORAGE_ENDPOINT`, `STORAGE_PUBLIC_URL`, `STORAGE_BUCKET_PREFIX`, `SITE_URL`, `PUBLIC_SITE_URL`, `PUBLIC_API_URL`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `N8N_WEBHOOK_BASE`) is committed in `.starcistacks/production/infra/swarm/api-public.conf` and merged into the api environment by the render; the names the be reads, with required or optional marked, are in `.starcistacks/production/infra/swarm/api.env.example`. The public web values `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_DEVELOPER_API_URL` are build arguments declared in `environments.production.deploy.images.web.buildArgs`.

## Releases, health and rollback

- **Immutable release.** A release is the rendered stack bytes (its sha256 is the release digest), the source commit, the api, web and landing image digests (the other images are pinned by digest in the stack source), the non-secret configuration digest, the secret and config runtime names, the health assertions and the previous accepted release. It lands in `/srv/nivo/releases/<digest16>/` (read-only) before the deploy, and the `current` pointer moves only after verification; `previous` keeps the last accepted release for a bounded rollback. The tracked records under `.starcistacks/production/infra/swarm/release/` state that rule and hold no live value.
- **Health signals.** The container healthcheck is liveness (`/healthz` of the api, `/health/live` of web and landing, process-local: a Supabase outage never restarts a task). Readiness (`/readyz`: the database answers within 2 seconds) gates traffic at the shared ingress (the Traefik health check in `.starcistacks/production/infra/swarm/edge/routes.yml`) and the deploy acceptance, never a restart. Startup is the healthcheck `start_period`. Functional verification is `starci app stack verify`.
- **Updates.** `nivo-api`, `nivo-mcp`, `nivo-web-app` and `nivo-landing` update start-first (`order: start-first`, `failure_action: rollback`, `monitor`, `max_failure_ratio: 0`, with `rollback_config`); the stateful services (`openclaw`, `n8n`) update stop-first because only one task may own a volume. A failed update rolls itself back; a failed deploy then deploys the previous accepted release again.
- **Job alerts** are raised by the api itself (an in-process monitor reads `job_stats()` every `JOBS_ALERT_INTERVAL`; over the limits it logs a `job-ops.alert.*` error event and writes an `app_errors` row, at most once per kind per 30 minutes). Limits: `JOBS_ALERT_FAILED_MAX` (20) and `JOBS_ALERT_STALE_SECONDS` (300), taken from the `stack` member's `JOBS_FAILED_ALERT` / `JOBS_STALE_SECONDS` when sealed. There is no host cron and no watchdog script.
- **Backups.** `starci app stack backup --env production [--swarm-state] --execute` writes age-encrypted tarballs of the n8n (SQLite) and OpenClaw volumes to `/srv/nivo/backups` (14 days); copy them off the VPS and prove a restore on an isolated host (`.starcistacks/production/infra/swarm/recovery/restore-proof.md`). The job queues are in the database, covered by the nightly `nivo-postgres-backup` dump (see "Self-hosted PostgreSQL").
- **Rollback boundary.** Redeploying a stored release restores service specifications and images. It cannot revert a schema change (migrations are forward-only) or recreate a removed secret. A data restore is a separate action with an explicit loss window.

## Self-hosted PostgreSQL

`nivo-postgres` (`supabase/postgres:17.11.0.006`, pinned by digest; PostgreSQL 17 like the cloud project, `major_version = 17`) is a stack service on the private `agents` network (`nivo-postgres:5432`, no published port) on the volume `nivo-engine_postgres-data`. It loads `pg_cron` and `pg_net` (`shared_preload_libraries`, `cron.database_name=postgres`) and carries `pgmq`, `vector`, `unaccent` and `pgcrypto`. The api and the mcp gateway keep their single database variable `PRIMARY_DB_URL` (role `app_be`, RLS applies), now `postgresql://app_be@nivo-postgres:5432/postgres`.

- **Backups.** `nivo-postgres-backup` writes `nivo-db-<UTC stamp>.dump.age` (+ `.sha256`) to the volume `nivo-engine_postgres-backups` daily at 02:00 Asia/Ho_Chi_Minh and at start when none is younger than 26 h: `pg_dump --format=custom`, age-encrypted to the recipient of `.sops.yaml`; files older than 14 days are deleted. Copy them off the VPS. The database starts CLEAN (the cloud data is not carried over): `db/bootstrap.sql` first (the `auth`/`storage` objects and roles the Supabase-written migrations reference, empty), then the migrations; the exact steps, the local rehearsal and the restore of a nightly file are in `infra/swarm/recovery/db-runbook.md`.
- **Migrations tooling.** Migrations live in `db/migrations/` (forward-only, archive in `db/migrations/archive/`) and reach this database with the harness verb that takes the connection from a named environment variable: `starci app db migrate --env production --url-env DATABASE_URL --execute`. `DATABASE_URL` is set in the operator shell only: `postgresql://postgres@127.0.0.1:55432/postgres`, reached through a loopback-only relay on the manager (the same pattern as the n8n editor: `docker run --rm --name nivo-tunnel-pg --network nivo_agents -p 127.0.0.1:55432:5432 alpine/socat tcp-listen:5432,fork,reuseaddr tcp-connect:nivo-postgres:5432`, then an SSH port-forward to the owner machine; the database port is never published). Take a backup first (`BACKUP_RUN_ONCE=1` or wait for the nightly file). `starci app stack deploy --urgent --db-url-env DATABASE_URL` runs the pending migrations the same way before it rolls the services. The `db-deploy` workflow still calls the Supabase CLI and is replaced by these verbs at cutover. `DATABASE_URL` is the operator-side name; the api's own name stays `PRIMARY_DB_URL` (a different role: superuser versus `app_be`).
- **Role password.** The migrations create `app_be` without a password. After the first start (and after any restore) the operator sets it from the sealed `APP_BE_DB_PASSWORD` and seals `PRIMARY_DB_URL` (runbook step 3).

## OpenClaw and the loopback rule

The OpenClaw gateway honours the scopes a client declares only for a loopback peer using the shared secret. The api does not share the gateway's network namespace; it connects to `ws://nivo-openclaw:18790`, service DNS on the private `agents` overlay network. The entrypoint wrapper starts a byte-for-byte TCP relay (`.starcistacks/production/infra/swarm/openclaw/openclaw-relay.mjs`) that forwards to `127.0.0.1:18789` inside the OpenClaw task, so the gateway sees a loopback peer. The gateway token is still required, and only the api (and an operator tunnel) is on that network. This is verified after a release by the chat-turn smoke check (the reply is not `direct_fallback`).

## The MCP gateway is internal only

`nivo-mcp` (`be/apps/mcp`, image `ghcr.io/starci183/nivo-lite-mcp`) has no host, no route in `infra/swarm/edge/routes.yml` and no DNS record, and it is
not on the `edge` network: it joins only the private `agents` overlay under the alias `nivo-mcp`, where the api and the OpenClaw gateway could reach it as
`http://nivo-mcp:8790/mcp/<workspaceId>`. For the demo its agent endpoint stays closed (it reads no agent token and fails closed); the api's chat
turns use the same gateway modules in-process. Reasons: (1) its callers are NIVO's own agents, all inside the stack, so a public route would only add attack
surface; (2) every call it accepts can reach a workspace's connectors (bookings, folios, key codes) with sealed service credentials, so exposure is
limited to the network that already holds the api and the agent gateway; (3) it keeps the shared ingress, its certificates and the tenant routes
untouched. HAKUEN's own MCP server is the public one; NIVO calls out to it. An external MCP client (for example a StarCi kernel agent) talks to HAKUEN
directly with its own scoped client, never through this gateway. For an operator check use a loopback relay like the n8n one (network `nivo_agents`,
host `nivo-mcp`, port 8790). Its container healthcheck probes `/healthz` (liveness); `starci app stack converge` asserts the task is healthy.

## The AI gateway and its virtual keys

The api process hosts `@starci/ai-router` 0.3.0 through `AiRouterGatewayModule`: no extra container or image. It listens on **8788** (`AI_ROUTER_PORT`, api 8787 + offset 1, declared on the `nivo-api` component) on the private `agents` network only: no route, no published port. The api calls it at `http://127.0.0.1:8788/v1`, openclaw at `http://nivo-api:8788/v1`. The pool holds one OpenRouter provider with the profiles `work` (`deepseek/deepseek-v4.1-flash`) and `embed` (`qwen/qwen3-embedding-8b`). Virtual keys are in SQLite (`AI_ROUTER_KEYS_PATH`) on the volume `nivo-engine_ai-router-data`, which `starci app stack backup` includes; losing it loses the keys (re-issue them). Sealed `api` member: `OPENROUTER_API_KEY`, `AI_ROUTER_ADMIN_TOKEN`, `AI_API_KEY`; sealed `stack` member: `OPENCLAW_AI_KEY` for openclaw.

**Virtual keys are mounted from secrets, no bootstrap step.** The two keys are generated secrets sealed like any other: `AI_API_KEY` (label `nivo_api`, profiles `work,embed`) in the `ai` member and `OPENCLAW_AI_KEY` (label `nivo_openclaw`, profile `work`) in the `openclaw` member, both of the form `sk-starci-<label>-<48 hex>`. The api reads both (file pointers) and passes them to the in-process gateway as mounted keys (`@starci/ai-router` 0.4.0): held in memory, never written to the key store, each under a fixed id per label for quota and usage. openclaw sends its own key. A mounted key is revoked only by changing its secret and deploying; the admin API cannot revoke it. Make or rotate one without ever printing it:

```sh
node -e "process.stdout.write('sk-starci-nivo_api-'+require('crypto').randomBytes(24).toString('hex'))" | npx starci app secret set production ai AI_API_KEY
node -e "process.stdout.write('sk-starci-nivo_openclaw-'+require('crypto').randomBytes(24).toString('hex'))" | npx starci app secret set production openclaw OPENCLAW_AI_KEY
```

then commit and deploy. Usage stays visible in the admin API (`keys list|usage --url http://nivo-api:8788` inside the api container, with `AI_ROUTER_ADMIN_TOKEN` read from its file).

## Shared ingress and the compose tenants

The Swarm Traefik is the SHARED ingress of the VPS: nivo plus the compose tenants, reached over the attachable overlay `nivo-edge-swarm`. It is a separate stack managed by `starci app stack ingress create|publish` from `environments.production.deploy.ingress`; nivo's routes (`.starcistacks/production/infra/swarm/edge/routes.yml`) are published into the shared dynamic directory as the file nivo.yml, and tenant route files are never touched. The standalone container of `nguyentuannam.org` must join `nivo-edge-swarm` with the alias `namnivo-web`; until then that one host answers 502 and the nivo.vn hosts are not affected. The history of the move from compose to Swarm is `be/docs/runbooks/cutover.md`.

## Cutover to self-hosted Postgres, auth and storage

The production move off Supabase cloud (locked for egress quota) is the step-by-step runbook with rollback in [CUTOVER-SELFHOST.md](CUTOVER-SELFHOST.md). The `db:*` package scripts now call `starci app db` with `--url-env DATABASE_URL`; the Supabase CLI scripts are gone.
