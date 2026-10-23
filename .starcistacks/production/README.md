# production

The production environment of NIVO: **Docker Swarm on one Ubuntu VPS** (a single-manager swarm: orchestration without manager failover; a lost manager needs recovery or a replacement), with the Supabase Cloud project as the external datastore. Components: `ingress` (the shared Traefik of the VPS), `landing` (`nivo.vn` / `www.nivo.vn`), `web` (console on `app.nivo.vn`), `api` (`api.nivo.vn`), `mcp` (the internal MCP gateway, no public host), `openclaw` and `n8n` (SQLite on the persisted volume `nivo-engine_n8n-data`; there is no self-hosted Postgres). The application stack publishes no port: the shared ingress owns 80 and 443 and the certificates. The zone `nivo.vn` is at Tino. The Swarm services carry the tenant-unique names `nivo-api`, `nivo-mcp`, `nivo-web-app`, `nivo-landing`, `nivo-openclaw` and `nivo-n8n` (full names `nivo_nivo-api` and so on), so no short alias such as `api` exists on the shared edge network; the edge aliases `nivo-api`, `nivo-web-swarm`, `nivo-landing` and `nivo-n8n` are unchanged. The stack source is `.starcistacks/production/infra/swarm/stack.yaml`; every deploy step is a verb of `starci app stack`, configured by `environments.production.deploy` of `.starcistacks/application-stacks.yaml`, and the release itself is the **deploy stack** workflow (`.github/workflows/stack-deploy.yml`). There is no compose project, no host crontab and no application script on the VPS.

## The seven commands

All commands run at the app root of an owner machine that holds the age identity (the `ops`, `vps-ssh-key` and `vps-known-hosts` members give the verbs their SSH session), or on the VPS manager. Effectful verbs are a dry run without `--execute`.

| Command | What it does |
| --- | --- |
| prepare | `starci app stack prepare --env production --execute`: host checks without effect (Ubuntu and Docker versions, linux/amd64, disk, ports, Swarm state, the external volumes), then creates the four external volumes a fresh host lacks (`nivo-engine_openclaw-data`, `nivo-engine_video-cache`, `nivo-engine_n8n-data`, `nivo-edge_acme`). `--init-swarm --owner-approved --execute` runs `docker swarm init` once, only after the owner approved it; an active swarm is never re-initialized. One-time host setup: `sudo install -d -o <deploy user> -m 750 /srv/nivo /srv/nivo/releases`. |
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
5. **Database deploy**: the `db-deploy` workflow opens the sealed `ops` member for `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_ID`, and needs a tracked backup receipt path as its input.

## Custody

Secrets are kept ONLY as sops-encrypted dotenv files in `.starcistacks/production/secrets/<slug>.enc`. The age recipient is in `.sops.yaml`; the age identity is `SOPS_AGE_KEY` in the owner's untracked runtime secret file and in the GitHub environment secret of the same name. No root dotenv file, no plaintext secrets file and no secrets directory exists, and none may be created.

- Read or change a value: `starci app secret list|get|set production <slug>` (values travel through stdin and memory only; `list` prints names).
- A release decrypts the members **in memory on the runner** and pipes each granted key into `docker secret create nivo-<key>-v<keyed hash> -` on the manager over the pinned ssh session (`starci app stack deploy`). The version is the first 10 hex of an HMAC of the key name and value under the age identity: a changed value is a new name; an unchanged one keeps its name, so a deploy restarts only what changed. The rendered stack keeps `{external: true, name: <runtimeName>}` and no value. The logical-name to runtime-name map is the `secrets` list of each release record (names only).
- Services read `/run/secrets/<KEY>` through `<KEY>_FILE`. OpenClaw has no `_FILE` support: its entrypoint wrapper (`.starcistacks/production/infra/swarm/openclaw/entrypoint.sh`) exports the gateway token and the provider keys from `/run/secrets` into the gateway process only.
- Rotation: `starci app secret set production <slug> <KEY>`, commit, run the **deploy stack** workflow. The new name is created and granted, convergence is observed, and only then does the prune step remove names that neither the accepted nor the previous release uses. A name is never reused.
- The connection key `CHANNEL_TOKEN_KEY` is the exception: one random 32-byte key, set once and never overwritten or rotated, because it seals every stored credential Its custody is guarded where it is used: the api and the mcp app open a credential already sealed in the database before they serve, and a key that was overwritten under stored credentials stops them with the connection-secrets key-mismatch error, so a replaced key never goes live. A per-request failure to open a credential is logged as an error and refused, never sent.
- The stack file declares one external stub per sealed member (`nivo-custody-<slug>-v1`) as the custody record the stack checks read; no service is granted a stub and no such Swarm secret exists.
- Local development uses the local Supabase stack and exported shell values, not these files.

## Sealed members (names only, values are never written down)

The key roster with semantics is `.starcistacks/production/runtime/env/KEYS.md`.

| Slug | Consumer | Keys |
| --- | --- | --- |
| `api` | api task (`<KEY>_FILE`); mcp task (`PRIMARY_DB_URL`, `CHANNEL_TOKEN_KEY` only) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHANNEL_TOKEN_KEY`, `N8N_SIGNING_SECRET`, `WEBHOOK_SIGNING_SECRET`, `NIVO_PLATFORM_ADMINS`, `OPENCLAW_TURN_TIMEOUT`, `SMTP_URL`, `SMTP_FROM`, `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NAME`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `PRIMARY_DB_URL`. Remote MCP connector credentials are not custody keys: they are sealed per workspace in the database from the console |
| `auth` | api task | `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (the api falls back to them for Google OAuth) |
| `stack` | openclaw, n8n, api | secrets: `OPENCLAW_GATEWAY_TOKEN` (also granted to the api), `N8N_ENCRYPTION_KEY`; `OPENCLAW_MANAGE_AGENTS` (`true` or `false`, granted to the api); configuration read at render time (not a Swarm secret): `OPENCLAW_MODEL`, `N8N_ALLOWED_HOSTS`, `JOBS_FAILED_ALERT` (api `JOBS_ALERT_FAILED_MAX`), `JOBS_STALE_SECONDS` (api `JOBS_ALERT_STALE_SECONDS`). Every other key is ignored by the deploy |
| `web` | web image build | the public Supabase build values of the console (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) read by `starci app stack build-args` |
| `app-be-db` | operator | `APP_BE_DB_PASSWORD` (the generated `app_be` role password, used once to build `PRIMARY_DB_URL`) |
| `ops` | operator verbs and the database deploy | `VPS_HOST`, `VPS_USER`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` |
| `test-accounts` | smoke tests | `READY_OWNER_*`, `READY_STAFF_*`, `DEMO_*` |
| `ci-ssh-key`, `vps-ssh-key`, `vps-known-hosts` | JSON envelopes of the deploy SSH material | one key each |

The non-secret production configuration (`PRIMARY_DB_SCHEMA`, `SITE_URL`, `PUBLIC_SITE_URL`, `PUBLIC_API_URL`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `N8N_WEBHOOK_BASE`) is committed in `.starcistacks/production/infra/swarm/api-public.conf` and merged into the api environment by the render; the names the be reads, with required or optional marked, are in `.starcistacks/production/infra/swarm/api.env.example`. The public web values `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_DEVELOPER_API_URL` are build arguments declared in `environments.production.deploy.images.web.buildArgs`.

## Releases, health and rollback

- **Immutable release.** A release is the rendered stack bytes (its sha256 is the release digest), the source commit, the api, web and landing image digests (the other images are pinned by digest in the stack source), the non-secret configuration digest, the secret and config runtime names, the health assertions and the previous accepted release. It lands in `/srv/nivo/releases/<digest16>/` (read-only) before the deploy, and the `current` pointer moves only after verification; `previous` keeps the last accepted release for a bounded rollback. The tracked records under `.starcistacks/production/infra/swarm/release/` state that rule and hold no live value.
- **Health signals.** The container healthcheck is liveness (`/healthz` of the api, `/health/live` of web and landing, process-local: a Supabase outage never restarts a task). Readiness (`/readyz`: the database answers within 2 seconds) gates traffic at the shared ingress (the Traefik health check in `.starcistacks/production/infra/swarm/edge/routes.yml`) and the deploy acceptance, never a restart. Startup is the healthcheck `start_period`. Functional verification is `starci app stack verify`.
- **Updates.** `nivo-api`, `nivo-mcp`, `nivo-web-app` and `nivo-landing` update start-first (`order: start-first`, `failure_action: rollback`, `monitor`, `max_failure_ratio: 0`, with `rollback_config`); the stateful services (`openclaw`, `n8n`) update stop-first because only one task may own a volume. A failed update rolls itself back; a failed deploy then deploys the previous accepted release again.
- **Job alerts** are raised by the api itself (an in-process monitor reads `job_stats()` every `JOBS_ALERT_INTERVAL`; over the limits it logs a `job-ops.alert.*` error event and writes an `app_errors` row, at most once per kind per 30 minutes). Limits: `JOBS_ALERT_FAILED_MAX` (20) and `JOBS_ALERT_STALE_SECONDS` (300), taken from the `stack` member's `JOBS_FAILED_ALERT` / `JOBS_STALE_SECONDS` when sealed. There is no host cron and no watchdog script.
- **Backups.** `starci app stack backup --env production [--swarm-state] --execute` writes age-encrypted tarballs of the n8n (SQLite) and OpenClaw volumes to `/srv/nivo/backups` (14 days); copy them off the VPS and prove a restore on an isolated host (`.starcistacks/production/infra/swarm/recovery/restore-proof.md`). The job queues are in Supabase (its backups).
- **Rollback boundary.** Redeploying a stored release restores service specifications and images. It cannot revert a schema change (migrations are forward-only) or recreate a removed secret. A data restore is a separate action with an explicit loss window.

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

## Shared ingress and the compose tenants

The Swarm Traefik is the SHARED ingress of the VPS: nivo plus the compose tenants, reached over the attachable overlay `nivo-edge-swarm`. It is a separate stack managed by `starci app stack ingress create|publish` from `environments.production.deploy.ingress`; nivo's routes (`.starcistacks/production/infra/swarm/edge/routes.yml`) are published into the shared dynamic directory as the file nivo.yml, and tenant route files are never touched. The standalone container of `nguyentuannam.org` must join `nivo-edge-swarm` with the alias `namnivo-web`; until then that one host answers 502 and the nivo.vn hosts are not affected. The history of the move from compose to Swarm is `be/docs/runbooks/cutover.md`.
