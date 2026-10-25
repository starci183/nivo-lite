# Environment keys (production)

Names only, never a value. The api reads its environment only through the typed `EnvSource` readers (`*.env.ts`, `*.config.ts`, `main.ts` of the app); a
`<KEY>_FILE` pointer to a mounted Swarm secret supplies the same value. Sealed members live in `.starcistacks/production/secrets/<slug>.enc`; the deploy
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
| `PRIMARY_DB_URL` | sealed `api` | The least-privilege `app_be` connection to the Supabase project (session pooler). |
| `PRIMARY_DB_SCHEMA` | `api-public.conf` | The schema the primary connection is bound to (`public`). |
| `SUPABASE_URL` | sealed `api` | The Supabase project origin. |
| `SUPABASE_SERVICE_ROLE_KEY` | sealed `api` | Service-role key for Auth and Storage administration; the back end never forwards it. |
| `OTP_PEPPER` | sealed `api` | At least 32 characters; hashes loyalty one-time codes. |
| `CHANNEL_TOKEN_KEY` | sealed `api` | Encrypts stored channel tokens and the per-workspace credentials of remote MCP connectors. One random 32-byte key, set once and never overwritten or rotated: a different key leaves every sealed credential unreadable. |
| `N8N_SIGNING_SECRET` | sealed `api` | Must equal what the n8n workflows sign with. |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | `api-public.conf` | Comma-separated exact HTTPS origins of the console and the landing. |
| `SITE_URL` | `api-public.conf` | The public origin of the console (`https://app.nivo.vn`); the browser return pages are served there. |
| `PUBLIC_SITE_URL` | `api-public.conf` | The public origin of the console, used in links the api sends. |
| `PUBLIC_API_URL` | `api-public.conf` | The public origin of the api (`https://api.nivo.vn`), used in webhook and callback URLs and as the base of the agents' tool door (`<origin>/agent-tools`); it must be https (http only for a loopback host) or the api refuses to boot. |
| `PORT` | stack environment | The listener port (`8787`). |
| `QUEUE_REDIS_PASSWORD` | sealed `api` | The password of the declared Redis (the BullMQ broker): the api reads it as `QUEUE_REDIS_PASSWORD_FILE`, the `nivo-redis` service starts with `--requirepass` from the same Swarm secret, and holds no trailing newline. Never printed, never read from a file by hand: `starci app secret set production api QUEUE_REDIS_PASSWORD --generate 32`. |
| `QUEUE_REDIS_HOST` | stack environment | `nivo-redis`, the one Redis service on the private `agents` network. |
| `QUEUE_REDIS_PORT` | stack environment | `6379`. |
| `QUEUE_REDIS_PREFIX` | stack environment | `nivo`, the key prefix of every queue in the broker. |

## api: optional capabilities

The capability is off while its keys are absent; a group is all-or-none where noted.

| Key | Semantics |
| --- | --- |
| `N8N_WEBHOOK_BASE` | Base URL of the n8n webhook the api emits events to (`http://nivo-n8n:5678/webhook/nivo-events`, set in `api-public.conf`); absent = no emission. |
| `N8N_ALLOWED_HOSTS` | Hosts the n8n client may call; a stack setting, default `n8n`. |
| `OPENCLAW_GATEWAY_URL` | Gateway URL (`ws://nivo-openclaw:18790`), set by the deploy block; absent or without credentials = the gateway is off. |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway token, granted to the api and to openclaw from the sealed `stack` member. |
| `OPENCLAW_GATEWAY_PASSWORD` | Alternative gateway credential when no token exists; not used in production. |
| `OPENCLAW_TOOL_SECRET` | Sealed `api`, read only through `OPENCLAW_TOOL_SECRET_FILE`: signs the per-turn tool token OpenClaw calls the api back with. Without it no token is minted, so a turn of an agent holding connector grants fails closed (`tools_not_configured`); other agents answer without tools. |
| `OPENCLAW_MANAGE_AGENTS` | `true` or `false`; granted from the sealed `stack` member. |
| `META_APP_ID` | The Meta app credentials (both or none); the Meta channels are off while absent. |
| `META_APP_SECRET` | The Meta app credentials (both or none); the Meta channels are off while absent. |
| `META_WEBHOOK_VERIFY_TOKEN` | The verify token of the Meta webhook subscription. |
| `SUPABASE_ANON_KEY` | Public anonymous key for user-scoped Supabase calls; optional. |
| `TELEGRAM_API_ID` | Telegram user-client application credentials (both or none); the user-account bridge is off while absent. |
| `TELEGRAM_API_HASH` | Telegram user-client application credentials (both or none); the user-account bridge is off while absent. |
| `CHANNEL_BOT_TOKEN` | Bot token of the channel provisioning helper; optional. |
| `ZALO_APP_SECRET` | Zalo app secret the channel provisioning cli (`connect-channel zalo`) seals into the new connection; read only through `ZALO_APP_SECRET_FILE` on the operator machine for that run, optional, and granted to no service. |
| `ZALO_OA_SECRET` | Zalo Official Account secret key the same cli seals beside the app secret; read only through `ZALO_OA_SECRET_FILE`, optional, and granted to no service. |
| `VPS_SSH_KEY` | SSH key the n8n host helper uses to reach the VPS; optional, the helper is off while absent. |
| `HTTP_SECURITY_TRUSTED_PROXY_HOPS` | `0`, `1` or `2`: trusted proxy hops before the api; optional. |
| `OPENROUTER_API_KEY` | Language-model provider keys: read by the api model client (`llm.config.ts`) and, from the sealed `api` member, granted to openclaw. |
| `DEEPSEEK_API_KEY` | Language-model provider keys: read by the api model client (`llm.config.ts`) and, from the sealed `api` member, granted to openclaw. |

## api: optional executable paths

These nonsecret keys select operator-installed executables. Omission retains the platform installation defaults. Paths must be absolute and local; the executable and every parent directory must be unwritable by untrusted users. PATH is never searched.

| Key | Semantics |
| --- | --- |
| `VIDEO_FFMPEG_PATH` | Optional trusted FFmpeg executable path. |
| `VIDEO_FFPROBE_PATH` | Optional trusted FFprobe executable path. |
| `VIDEO_NICE_PATH` | Optional trusted priority-lowering executable path, used when priority lowering is enabled. |

## mcp (the NIVO MCP gateway, `be/apps/mcp`)

The gateway reads only these keys (`be/apps/mcp/src/mcp.env.ts`). Its secrets come from the same sealed `api` member as the api's, granted key by key
(`deploy.secrets.grants`, service `nivo-mcp`); the non-secret values are `deploy.environment.nivo-mcp.values`.

| Key | Where | Semantics |
| --- | --- | --- |
| `PORT` | stack environment | The listener port (`8790`); internal only, on the private `agents` network as `nivo-mcp`. |
| `PRIMARY_DB_URL` | sealed `api` (required) | The same `app_be` connection as the api: connectors, grants and the call audit. |
| `CHANNEL_TOKEN_KEY` | sealed `api` (required) | The same connection key as the api: it opens the bearer credential each remote connector has sealed in its own `mcp_connectors` row. Connector credentials are set per workspace in the console (Settings > Connections), never as deployment keys. |
| `PRIMARY_DB_SCHEMA` | stack environment | `public`. |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | stack environment | The OriginGuard and CORS allowlist (`https://app.nivo.vn`); the gateway has no browser caller, so only the console origin is listed. |
| `MCP_GATEWAY_TIMEOUT_MS` | not set | Per-call timeout, default 4000. |
| `MCP_CLIENT_NAME` | not set | Client name announced to remote MCP servers, default `nivo-mcp-gateway`. |

## Stack settings (sealed `stack`, read at render time)

| Key | Semantics |
| --- | --- |
| `OPENCLAW_MODEL` | The model the openclaw service runs (default `openrouter/deepseek/deepseek-v4-flash`). |
| `JOBS_FAILED_ALERT` | Becomes the api `JOBS_ALERT_FAILED_MAX` (default 20). |
| `JOBS_STALE_SECONDS` | Becomes the api `JOBS_ALERT_STALE_SECONDS` (default 300). |
| `N8N_ENCRYPTION_KEY` | Swarm secret of the n8n service (`N8N_ENCRYPTION_KEY_FILE`). |

## Operator-held members (no service reads them)

| Key | Member | Semantics |
| --- | --- | --- |
| `APP_BE_DB_PASSWORD` | `app-be-db` | Password of the `app_be` database role; the owner uses it to rebuild `PRIMARY_DB_URL`. |
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
| `SUPABASE_ACCESS_TOKEN` | `ops` | Supabase management token, database password and project ref the database deploy workflow reads after `starci app secret materialize`. |
| `SUPABASE_DB_PASSWORD` | `ops` | Supabase management token, database password and project ref the database deploy workflow reads after `starci app secret materialize`. |
| `SUPABASE_PROJECT_ID` | `ops` | Supabase management token, database password and project ref the database deploy workflow reads after `starci app secret materialize`. |
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
| `NEXT_PUBLIC_SUPABASE_URL` | The public Supabase project origin and anonymous key. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The public Supabase project origin and anonymous key. |
