# Environment keys (production)

Names only, never a value. The api reads its environment only through the typed `EnvSource` readers (`*.env.ts`, `*.config.ts`, `main.ts` of the app); a
`<KEY>_FILE` pointer to a mounted Swarm secret supplies the same value. Sealed members live in `.starcistacks/production/secrets/<provider>.enc.yaml`; the deploy
turns every granted key into one versioned Swarm secret (see the production README). A required key without a value stops boot with its name.

## Two secret zones

- **App and platform secrets** stay sealed in this custody and are loaded at deploy: everything the api, the mcp app (the MCP
  gateway itself) or the platform needs whatever the tenants, with zero workspaces: the database connection, service-to-service
  keys, the gateway's own auth and the connection key `CHANNEL_TOKEN_KEY`. They are never moved to the database.
- **Workspace (tenant) secrets** are sealed in the database per workspace with the connection key and entered in the console: a
  channel connection's tokens and a remote MCP connector's credential (for example the HAKUEN connector's client secret). They are
  never deployment keys and never listed here.

## api: required

| Key | Where | Semantics |
| --- | --- | --- |
| `PRIMARY_DB_URL` | its sealed member (granted in `application-stacks.yaml`) | The least-privilege `app_be` connection to the self-hosted PostgreSQL of the stack (`nivo-postgres:5432`, private network, RLS applies). |
| `PRIMARY_DB_SCHEMA` | `api-public.conf` | The schema the primary connection is bound to (`public`). |
| `STORAGE_ACCESS_KEY` | its sealed member (granted in `application-stacks.yaml`) | MinIO service-account access key of the S3 object store. |
| `STORAGE_SECRET_KEY` | its sealed member (granted in `application-stacks.yaml`) | MinIO service-account secret key of the S3 object store. |
| `OTP_PEPPER` | its sealed member (granted in `application-stacks.yaml`) | At least 32 characters; hashes loyalty one-time codes. |
| `CHANNEL_TOKEN_KEY` | its sealed member (granted in `application-stacks.yaml`) | Encrypts stored channel tokens and the per-workspace credentials of remote MCP connectors. One random 32-byte key, set once and never overwritten or rotated: a different key leaves every sealed credential unreadable. |
| `N8N_SIGNING_SECRET` | its sealed member (granted in `application-stacks.yaml`) | Must equal what the n8n workflows sign with. |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | `api-public.conf` | Comma-separated exact HTTPS origins of the console and the landing. |
| `SITE_URL` | `api-public.conf` | The public origin of the console (`https://app.nivo.vn`); the browser return pages are served there. |
| `PUBLIC_SITE_URL` | `api-public.conf` | The public origin of the console, used in links the api sends. |
| `PUBLIC_API_URL` | `api-public.conf` | The public origin of the api (`https://api.nivo.vn`), used in webhook and callback URLs and as the base of the agents' tool door (`<origin>/agent-tools`); it must be https (http only for a loopback host) or the api refuses to boot. |
| `AUTH_WEB_ORIGIN` | `api-public.conf` | The public origin of the console (`https://app.nivo.vn`) the own auth returns browsers to and trusts for cookies. |
| `AUTH_GOOGLE_CALLBACK_URL` | `api-public.conf` | The Google sign-in callback registered with the OAuth client (`https://api.nivo.vn/auth/google/callback`). |
| `STORAGE_ENDPOINT` | `api-public.conf` | The MinIO S3 address over the shared `nivo-edge-swarm` overlay (`http://academy-minio:9000`); public configuration, not a secret. |
| `STORAGE_PUBLIC_URL` | `api-public.conf` | The origin browsers upload to and read from (`https://minio.starci.org`); presigned addresses are signed for it. |
| `STORAGE_BUCKET_PREFIX` | `api-public.conf` | `nivo`: buckets are `<prefix>-avatars-public`, `-media`, `-videos`, `-hiring`, `-knowledge-uploads`. |
| `PORT` | stack environment | The listener port (`8787`). |
| `QUEUE_REDIS_PASSWORD` | its sealed member (granted in `application-stacks.yaml`) | The password of the declared Redis (the BullMQ broker): the api reads it as `QUEUE_REDIS_PASSWORD_FILE`, the `nivo-redis` service starts with `--requirepass` from the same Swarm secret, and holds no trailing newline. Never printed, never read from a file by hand: `starci app secret set production api QUEUE_REDIS_PASSWORD --generate 32`. |
| `QUEUE_REDIS_HOST` | stack environment | `nivo-redis`, the one Redis service on the private `agents` network. |
| `QUEUE_REDIS_PORT` | stack environment | `6379`. |
| `QUEUE_REDIS_PREFIX` | stack environment | `nivo`, the key prefix of every queue in the broker. |
| `REALTIME_HUB` | stack environment | `redis`, the shared realtime hub (replay stream plus Pub/Sub) so any api replica serves any stream. |
| `REALTIME_REDIS_PREFIX` | stack environment | `nivo-realtime`, the prefix of the hub's channel and stream keys; it shares the `nivo-redis` server under a prefix of its own. The hub declares no secret: with no `REALTIME_REDIS_URL` it connects to `QUEUE_REDIS_HOST`, `QUEUE_REDIS_PORT` and the sealed `QUEUE_REDIS_PASSWORD`. |

## api: optional capabilities

The capability is off while its keys are absent; a group is all-or-none where noted.

| Key | Semantics |
| --- | --- |
| `N8N_WEBHOOK_BASE` | Base URL of the n8n webhook the api emits events to (`http://nivo-n8n:5678/webhook/nivo-events`, set in `api-public.conf`); absent = no emission. |
| `N8N_ALLOWED_HOSTS` | Hosts the n8n client may call; a stack setting, default `n8n`. |
| `N8N_PROTOCOL` | The protocol n8n serves its editor and webhooks on behind the proxy; a stack setting, `https` in production. |
| `N8N_SECURE_COOKIE` | Whether n8n marks its session cookie secure; a stack setting, `true` in production. |
| `OPENCLAW_GATEWAY_URL` | Gateway URL (`ws://nivo-openclaw:18790`), set by the deploy block; absent or without credentials = the gateway is off. |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway token, granted to the api and to openclaw from the sealed `openclaw`/`n8n` member. |
| `OPENCLAW_GATEWAY_PASSWORD` | Alternative gateway credential when no token exists; not used in production. |
| `OPENCLAW_AI_KEY` | The virtual key of the AI gateway that openclaw uses, sealed in the `openclaw` member and granted to the openclaw service only. |
| `BACKUP_RUN_ONCE` | Stack environment of `nivo-postgres-backup`: `1` takes one backup now and exits (tests and the manual run); unset keeps the daily schedule. |
| `OPENCLAW_TOOL_SECRET` | Sealed `api`, read only through `OPENCLAW_TOOL_SECRET_FILE`: signs the per-turn tool token OpenClaw calls the api back with. Without it no token is minted, so a turn of an agent holding connector grants fails closed (`tools_not_configured`); other agents answer without tools. |
| `OPENCLAW_MANAGE_AGENTS` | `true` or `false`; granted from the sealed `openclaw`/`n8n` member. |
| `META_APP_ID` | The Meta app credentials (both or none); the Meta channels are off while absent. |
| `META_APP_SECRET` | The Meta app credentials (both or none); the Meta channels are off while absent. |
| `META_WEBHOOK_VERIFY_TOKEN` | The verify token of the Meta webhook subscription. |
| `TELEGRAM_API_ID` | Telegram user-client application credentials (both or none); the user-account bridge is off while absent. |
| `TELEGRAM_API_HASH` | Telegram user-client application credentials (both or none); the user-account bridge is off while absent. |
| `CHANNEL_BOT_TOKEN` | Bot token of the channel provisioning helper; optional. |
| `ZALO_APP_SECRET` | Zalo app secret the channel provisioning cli (`connect-channel zalo`) seals into the new connection; read only through `ZALO_APP_SECRET_FILE` on the operator machine for that run, optional, and granted to no service. |
| `ZALO_OA_SECRET` | Zalo Official Account secret key the same cli seals beside the app secret; read only through `ZALO_OA_SECRET_FILE`, optional, and granted to no service. |
| `VPS_SSH_KEY` | SSH key the n8n host helper uses to reach the VPS; optional, the helper is off while absent. |
| `HTTP_SECURITY_TRUSTED_PROXY_HOPS` | `0`, `1` or `2`: trusted proxy hops before the api; optional. |
| `AI_BASE_URL` | The AI gateway base URL (`http://ai-router:8788/v1`), a stack value of the api and openclaw; the port is the declared `port` of the `ai-router` component. |
| `AI_API_KEY` | The caller's virtual key of the AI gateway (`sk-starci-nivo_api-...`), sealed in `api`, read through `AI_API_KEY_FILE`. openclaw has its own (`nivo_openclaw`) sealed in `stack`. |
| `AI_CHAT_MODEL` | Profile the chat calls use (default `work`; stack value). |
| `AI_EMBEDDING_MODEL` | Profile the embedding calls use (default `embed`; stack value). |

## api: optional executable paths

These nonsecret keys select operator-installed executables. Omission retains the platform installation defaults. Paths must be absolute and local; the executable and every parent directory must be unwritable by untrusted users. PATH is never searched.

| Key | Semantics |
| --- | --- |
| `VIDEO_FFMPEG_PATH` | Optional trusted FFmpeg executable path. |
| `VIDEO_FFPROBE_PATH` | Optional trusted FFprobe executable path. |
| `VIDEO_NICE_PATH` | Optional trusted priority-lowering executable path, used when priority lowering is enabled. |

## mcp (the NIVO MCP gateway, `be/apps/mcp`)

The gateway reads only these keys (`be/apps/mcp/src/mcp.env.ts`). Its secrets come from the same its sealed member (granted in `application-stacks.yaml`) member as the api's, granted key by key
(`deploy.secrets.grants`, service `nivo-mcp`); the non-secret values are `deploy.environment.nivo-mcp.values`.

| Key | Where | Semantics |
| --- | --- | --- |
| `PORT` | stack environment | The listener port (`8790`); internal only, on the private `agents` network as `nivo-mcp`. |
| `PRIMARY_DB_URL` | its sealed member (granted in `application-stacks.yaml`) (required) | The same `app_be` connection as the api: connectors, grants and the call audit. |
| `CHANNEL_TOKEN_KEY` | its sealed member (granted in `application-stacks.yaml`) (required) | The same connection key as the api: it opens the bearer credential each remote connector has sealed in its own `mcp_connectors` row. Connector credentials are set per workspace in the console (Settings > Connections), never as deployment keys. |
| `PRIMARY_DB_SCHEMA` | stack environment | `public`. |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | stack environment | The OriginGuard and CORS allowlist (`https://app.nivo.vn`); the gateway has no browser caller, so only the console origin is listed. |
| `MCP_GATEWAY_TIMEOUT_MS` | not set | Per-call timeout, default 4000. |
| `MCP_CLIENT_NAME` | not set | Client name announced to remote MCP servers, default `nivo-mcp-gateway`. |

## Stack settings (sealed `openclaw`/`n8n`, read at render time)

| Key | Semantics |
| --- | --- |
| `OPENCLAW_MODEL` | The model the openclaw service runs (default `nivo-ai/work`, the openclaw provider that points at the AI gateway). |
| `JOBS_FAILED_ALERT` | Becomes the api `JOBS_ALERT_FAILED_MAX` (default 20). |
| `JOBS_STALE_SECONDS` | Becomes the api `JOBS_ALERT_STALE_SECONDS` (default 300). |
| `N8N_ENCRYPTION_KEY` | Swarm secret of the n8n service (`N8N_ENCRYPTION_KEY_FILE`). |

## Operator-held members (no service reads them)

| Key | Member | Semantics |
| --- | --- | --- |
| `APP_BE_DB_PASSWORD` | `app-be-db` (legacy cloud role) and `postgres` | Password of the `app_be` database role; the owner uses it to set the role and rebuild `PRIMARY_DB_URL`. |
| `POSTGRES_PASSWORD` | `postgres` (declared, not yet sealed) | Superuser password of `nivo-postgres` (`POSTGRES_PASSWORD_FILE`); also read by `nivo-postgres-backup` for pg_dump. Migrations use it through `DATABASE_URL` (shell only, see the README). |
| `VPS_HOST` | `ops` | The manager account `starci app stack` verbs connect to from the owner machine. |
| `VPS_USER` | `ops` | The manager account `starci app stack` verbs connect to from the owner machine. |
| `DEMO_EMAIL` | `test-accounts` | Demo accounts of the post-deploy smoke tests. |
| `DEMO_PASSWORD` | `test-accounts` | Demo accounts of the post-deploy smoke tests. |
| `DEMO_STAFF_PASSWORD` | `test-accounts` | Demo accounts of the post-deploy smoke tests. |
| `READY_OWNER_EMAIL` | `test-accounts` | Ready-state accounts of the post-deploy smoke tests. |
| `READY_OWNER_PASSWORD` | `test-accounts` | Ready-state accounts of the post-deploy smoke tests. |
| `READY_STAFF_EMAIL` | `test-accounts` | Ready-state accounts of the post-deploy smoke tests. |
| `READY_STAFF_PASSWORD` | `test-accounts` | Ready-state accounts of the post-deploy smoke tests. |
| `WORKSPACE_SEED_INPUT` | `test-accounts` | Private ensure input (owner, manager, staff accounts and workspace name) the **seed demo workspace** workflow (`.github/workflows/cli-deploy.yml`) hands to `cli seed-workspace profile` as `WORKSPACE_SEED_INPUT_FILE`. |
| `WORKSPACE_PROFILE_INPUT` | `test-accounts` | Private profile input `{"schema":"nivo/workspace-profile-input@1","connectors":{"hakuen":{"url":"https://..."}}}`: the endpoint of each remote MCP connector the profile registers. The same workflow hands it to `cli seed-workspace profile` as `WORKSPACE_PROFILE_INPUT_FILE`; a dry run refuses when a connector endpoint is missing. |
| `privateKey` | `vps-ssh-key` | Property of the operator SSH key envelope once re-sealed (`starci app stack` reads `privateKey`, `key` or `data`). |
| `knownHosts` | `vps-known-hosts` | Property of the pinned host keys envelope once re-sealed (`starci app stack` reads `knownHosts`, `known_hosts` or `data`). |
| `ciPrivateKey` | `ci-ssh-key` | Property of the CI deploy key envelope once re-sealed, so that no two members hold the same key. |
| `SOPS_AGE_KEY` | not sealed | The owner's age identity (untracked `.claude/secret.env` and the CI environment secret); never an application key. |

## web: public build values

Public by design, passed as image build arguments (`deploy.images.web.buildArgs`) and never runtime secrets.

| Key | Semantics |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The public origin of the app (`https://app.nivo.vn`) or, for the landing, of the landing (`https://nivo.vn`). |
| `NEXT_PUBLIC_LANDING_URL` | The landing origin (`https://nivo.vn`). |
| `NEXT_PUBLIC_APP_URL` | The console origin the landing links to (`https://app.nivo.vn`). |
| `NEXT_PUBLIC_API_URL` | The api origin (`https://api.nivo.vn`). |
| `NEXT_PUBLIC_DEVELOPER_API_URL` | The api origin (`https://api.nivo.vn`). |

## AI gateway (in the api process, `@starci/ai-router` 0.3.0)

The api hosts the gateway through `AiRouterGatewayModule`; it listens on `AI_ROUTER_PORT` (8788 = api 8787 + offset 1) on the private `agents` network only (no route, no published port). The upstream key is held only by the api.

| Key | Where | Semantics |
| --- | --- | --- |
| `AI_ROUTER_PORT` | api stack value | The gateway listener (`8788`); declared on the `nivo-api` component. |
| `AI_ROUTER_KEYS_PATH` | api stack value | SQLite key store (`/var/lib/ai-router/keys.sqlite`) on the volume `nivo-engine_ai-router-data`. |
| `AI_ROUTER_ADMIN_TOKEN` | its sealed member (granted in `application-stacks.yaml`) | Bearer token of the gateway admin API; the `keys ...` CLI reads it from the same variable. |
| `OPENROUTER_API_KEY` | its sealed member (granted in `application-stacks.yaml`) | The single upstream key (OpenRouter). |
| `AI_API_KEY` | its sealed member (granted in `application-stacks.yaml`) | The api's virtual key (`nivo_api`). openclaw has its own, `OPENCLAW_AI_KEY` (virtual key `nivo_openclaw`), sealed in `stack`, exported by the entrypoint wrapper; openclaw holds no OpenRouter key. Mounted by the gateway from this secret at boot (no key is issued by hand); it must start with `sk-starci-nivo_api-`. |

## Self-hosted cutover (sh-cutover)

Names the self-hosted stack relies on (Postgres, own auth, MinIO). Owning lanes seal their own rows; this lists only the cutover view.

| Key | Member | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `api` | Connection of the self-hosted `nivo-postgres` as `app_be`; the default env of `starci app db plan|migrate|dump --url-env` (and of `app stack deploy --urgent --db-url-env`). Replaces the Supabase `PRIMARY_DB_URL`. |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | `auth` | Google sign-in of our own auth; replace `SUPABASE_AUTH_EXTERNAL_GOOGLE_*`. |
| auth signing key, storage endpoint and keys | `auth`, `api` | Exact names owned by sh-authbe and sh-storage (BE_AUTH_JWT_OWN_JWKS, BE_STORAGE_OWNER). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | retired | No longer baked into the web image. |
