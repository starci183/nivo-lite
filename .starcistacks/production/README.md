# production

The production environment of nivo-lite: the Supabase Cloud project, the api container and its OpenClaw and n8n stack on the VPS, and the web container, all behind one Traefik edge that serves `nivo.vn` and `www.nivo.vn` (web) and `api.nivo.vn` (api); the zone is at Tino.

## Custody

Secrets are kept ONLY as sops-encrypted dotenv files in `.starcistacks/production/secrets/<slug>.enc`. The age recipient is in `.sops.yaml`; the age identity is `SOPS_AGE_KEY` in the canonical StarCi runtime `.claude/secret.env`, loaded into the shell environment and never echoed. The owner backs up `secret.env`: losing it loses every sealed secret. No `.env*`, `secrets.env` or `.secrets/` exists, and none may be created.

- Read or change a value: `starci app secret list|show|set production <slug>` (values travel through stdin and memory only).
- Deploy: the GitHub environment `production` holds the one secret `SOPS_AGE_KEY` (plus the transport credentials `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` and the variables `VPS_HOST`, `VPS_USER`). Each deploy job runs `node deploy/materialize.mjs` (plain sops; `starci app secret materialize` replaces it after the canon repin), which writes one file per key; the containers read `<NAME>_FILE`. No dotenv blob is stored in GitHub.
- Local development uses the local Supabase stack and exported shell values, not these files.

## Sealed members (names only, values are never written down)

| Slug | Consumer | Keys |
|---|---|---|
| `api` | api container (`<KEY>_FILE`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHANNEL_TOKEN_KEY`, `N8N_SIGNING_SECRET`, `WEBHOOK_SIGNING_SECRET`, `NIVO_PLATFORM_ADMINS`, `OPENCLAW_TURN_TIMEOUT`, `SMTP_URL`, `SMTP_FROM`, `SEPAY_WEBHOOK_API_KEY`, `SEPAY_BANK_ACCOUNT`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NAME`, `BANK_WEBHOOK_SECRET`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`; produced on cutover day: `PRIMARY_DB_URL`; to add when the capability is wanted: `OPENCLAW_TOOL_SECRET`, `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` |
| `auth` | api container | `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (the api falls back to them for Google OAuth) |
| `stack` | OpenClaw, n8n, compose | secrets: `OPENCLAW_GATEWAY_TOKEN`, `N8N_ENCRYPTION_KEY`, `N8N_DB_PASSWORD`; copied to the api: `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_MANAGE_AGENTS` (`true` or `false`); settings copied to compose `.env`: `OPENCLAW_IMAGE`, `OPENCLAW_TAG`, `OPENCLAW_MODEL`, `N8N_TAG`, `N8N_ALLOWED_HOSTS`, `API_BIND`, `JOBS_FAILED_ALERT`, `JOBS_STALE_SECONDS`. Every other key (`ENGINE_*`, `N8N_HOST`, `N8N_BIND`, ...) is ignored by the deploy and should be removed |
| `web` | web build | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public values read at build time by `deploy/materialize.mjs public`); the other keys are unread |
| `app-be-db` | cutover scripts | `APP_BE_DB_PASSWORD` (the generated `app_be` role password, used once to build `PRIMARY_DB_URL`) |
| `ops` | cutover scripts | `VPS_HOST`, `VPS_USER` and the sealed SSH key pointers |
| `test-accounts` | smoke tests | `READY_OWNER_*`, `READY_STAFF_*`, `DEMO_*` |
| `ci-ssh-key`, `vps-ssh-key`, `vps-known-hosts` | JSON envelopes of the deploy SSH material | one key each |

The non-secret production configuration (`PRIMARY_DB_SCHEMA`, `SITE_URL`, `PUBLIC_SITE_URL`, `PUBLIC_API_URL=https://api.nivo.vn`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `N8N_WEBHOOK_BASE`) is committed in `deploy/stack/api-public.conf`; the public web values `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_DEVELOPER_API_URL` default to `https://api.nivo.vn` in the web workflow and Dockerfile. The names the be reads, with required or optional marked, are in `deploy/stack/api.env.example`; the cutover checklist is `be/docs/runbooks/cutover.md`.

Obsolete keys still sealed (the owner deletes them; nothing reads them): `stack`: `ENGINE_SHARED_SECRET` (replaced by `api` `WEBHOOK_SIGNING_SECRET`), `ENGINE_WORKER_ID`, `ENGINE_CONCURRENCY`, `ENGINE_POLL_MS`, `ENGINE_LEASE_SECONDS`, `ENGINE_SHUTDOWN_GRACE_MS`, `ENGINE_VERSION`, `ENGINE_BIND`, `OPENCLAW_TURN_TIMEOUT_MS`, `N8N_DEFAULT_WEBHOOK_URL`, `N8N_HOST`, `N8N_PROTOCOL`, `N8N_WEBHOOK_URL`, `N8N_SECURE_COOKIE`, `N8N_BIND`, and the duplicate `N8N_SIGNING_SECRET`; `api`: `NIVO_DRIVE_READ_EMAILS`, `NIVO_BASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`; `ops`: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE` (the zone is at Tino); `web`: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEMO_LOGIN`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`, `NEXT_PUBLIC_GOOGLE_APP_ID`.
