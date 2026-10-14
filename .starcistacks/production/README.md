# production

The production environment of nivo-lite: the Supabase Cloud project, the api container on the VPS and the web container.

Its secrets are kept ONLY as sops-encrypted dotenv files in `.starcistacks/production/secrets/<slug>.enc` (age recipient in `.sops.yaml`; the age identity is `SOPS_AGE_KEY` in the canonical runtime `.claude/secret.env`, loaded into the shell environment (never echoed); the owner backs up secret.env). No `.env*` and no plaintext `secrets.env` is kept: decrypt in memory with `sops -d --input-type dotenv --output-type dotenv <file>`, or push straight to the GitHub environment `production` (`sops -d ... | gh secret set API_ENV --env production`). The slugs are `app-be-db` (the generated `app_be` password), `api`, `web`, `stack`, `vps`, `cloudflare` and `accounts`. The authoritative list of names the be and the fe read, with required or optional marked, is in `be/docs/runbooks/cutover.md` (section Secrets); names only, values are never written down. The old `scripts/with-secrets.mjs`, `scripts/set-secrets.ps1` and `scripts/env-sync.mjs` belong to the retired plaintext custody.

## Names per sealed file

The blocks below are the dotenv layout of the sealed files (the section headers map to the slugs). Fill the values only inside `sops`, never in a plaintext file.

```ini

# ---------- [app] the web app (public values) and the server-side keys the api inherits; Supabase Cloud
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://nivo.vn
NEXT_PUBLIC_API_URL=https://api.nivo.vn
NEXT_PUBLIC_DEVELOPER_API_URL=https://api.nivo.vn
CHANNEL_TOKEN_KEY=
NIVO_PLATFORM_ADMINS=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://openrouter.ai/api/v1
DEEPSEEK_MODEL=deepseek/deepseek-v4-flash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=
SMTP_URL=
SMTP_FROM=
SEPAY_WEBHOOK_API_KEY=
SEPAY_BANK_ACCOUNT=
SEPAY_BANK_CODE=
SEPAY_ACCOUNT_NAME=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
BANK_WEBHOOK_SECRET=
# Meta (Facebook Pages + Instagram). One Meta app for all of NIVO: App ID/secret from developers.facebook.com, a verify token you invent
# (the same string goes into the app's Webhooks > Verify token). META_LOGIN_CONFIG_ID is optional (Facebook Login for Business configuration).
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=
META_GRAPH_VERSION=v21.0
META_LOGIN_CONFIG_ID=
META_SEND_PER_MINUTE=60
NEXT_PUBLIC_DEMO_LOGIN=
DEMO_EMAIL=
DEMO_PASSWORD=
DEMO_STAFF_PASSWORD=

# ---------- [stack] VPS docker stack: OpenClaw, n8n and the wiring of the api container (this block = GitHub secret ENGINE_ENV, the stack .env).
# The legacy header [engine] is still read by env-sync. The api's own keys are in [api] below.
OPENCLAW_IMAGE=ghcr.io/openclaw/openclaw
OPENCLAW_TAG=2026.7.1
OPENCLAW_GATEWAY_TOKEN=
OPENCLAW_MODEL=openrouter/deepseek/deepseek-v4-flash
OPENROUTER_API_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
N8N_TAG=1.64.3
N8N_ENCRYPTION_KEY=
N8N_DB_PASSWORD=
N8N_ALLOWED_HOSTS=n8n
N8N_BIND=172.29.0.1
API_BIND=172.29.0.1
N8N_HOST=n8n.nivo.vn
N8N_PROTOCOL=https
N8N_WEBHOOK_URL=https://n8n.nivo.vn/
N8N_SECURE_COOKIE=true
# Watchdog thresholds (see deploy/stack/watchdog.sh): alert when this many jobs failed in 24 h, or a job has waited in its queue this long.
JOBS_FAILED_ALERT=20
JOBS_STALE_SECONDS=300

# ---------- [api] runtime environment of the api container (this block + the server-side keys of [app] = GitHub secret API_ENV, api.env on the VPS; file api.enc)
# env-sync inherits the [app] server-side keys, the Supabase and OpenClaw keys, the embedding and Google keys when they are not set here.
# Required: PRIMARY_DB_URL (role app_be via the session pooler; its password is sealed in app-be-db.enc and set once with: alter role app_be password), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
PRIMARY_DB_URL=
PRIMARY_DB_SCHEMA=public
PORT=8787
SITE_URL=https://nivo.vn
PUBLIC_SITE_URL=https://nivo.vn
PUBLIC_API_URL=https://api.nivo.vn
N8N_SIGNING_SECRET=
HTTP_SECURITY_ALLOWED_ORIGINS=https://nivo.vn,https://www.nivo.vn
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
N8N_WEBHOOK_BASE=http://n8n:5678/webhook/nivo-events
OPENCLAW_TURN_TIMEOUT=90000
OPENCLAW_MANAGE_AGENTS=1
# Queues and jobs (pgmq in this project's Supabase). Optional tunables with literal defaults in the code:
# QUEUE_ENABLED, QUEUE_CONCURRENCY, QUEUE_WORKSPACE_CONCURRENCY, QUEUE_POLL_INTERVAL, QUEUE_VISIBILITY_TIMEOUT, QUEUE_SHUTDOWN_GRACE, JOBS_LEASE, JOBS_WORKER_ID
# Knowledge keys: leave empty to inherit (CHANNEL_TOKEN_KEY, the Google OAuth client from SUPABASE_AUTH_EXTERNAL_GOOGLE_*, OPENROUTER_API_KEY from DEEPSEEK_API_KEY).
EMBEDDING_MODEL=qwen/qwen3-embedding-8b
EMBEDDING_BASE_URL=https://openrouter.ai/api/v1
EMBEDDING_API_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
# Webhook signing secrets follow <PROVIDER>_WEBHOOK_SECRET / <PROVIDER>_WEBHOOK_TOLERANCE as each provider lane lands.

# ---------- [accounts] ready accounts on production (Spa Hoa Mai)
READY_OWNER_EMAIL=
READY_OWNER_PASSWORD=
READY_STAFF_EMAIL=
READY_STAFF_PASSWORD=

# ---------- [vps] SSH; key files are in .secrets/ next to this file
VPS_HOST=
VPS_USER=nivo
VPS_SSH_KEY=.secrets/vps_ed25519
VPS_CI_SSH_KEY=.secrets/ci_ed25519
VPS_KNOWN_HOSTS=.secrets/vps_known_hosts

# ---------- [cloudflare] DNS for nivo.vn (deploy/stack/dns-rollback.mjs)
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE=nivo.vn

# ---------- [perf] optional: PERF_LOG=1 prints, per request, every Supabase call (method + path + ms), the sequential depth and a TOTAL line.
# Set it on the server (the VPS api.env) only while measuring.
# PERF_LOG=1
```
