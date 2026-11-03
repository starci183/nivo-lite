# Environment keys (development)

Names only. Dev values are sealed in `.starcistacks/dev/secrets/<member>.enc.yaml`, generated once by the owner-armed
`starci app secret init --env dev --execute` (except the owner's `ai` and `auth` members) and opened by `starci app stack up --env dev --execute`
into private files outside the repository (`<KEY>_FILE`, which the back end reads first). Non-secret values are the manifest's
`local.processes.<name>.env`. The api reads the same keys as in production (see the production KEYS.md).

| Key | Member / source | Consumer |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `db` | the db container's superuser (compose value) |
| `DEV_DB_OWNER_PASSWORD` | `db` | the environment's own owner role `nivo_lite_dev`, which runs the migrations |
| `DEV_DB_APP_PASSWORD` | `db` | the `app_be` role of this environment; composed into `PRIMARY_DB_URL` (read through `PRIMARY_DB_URL_FILE`) |
| `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | `storage` | MinIO's root user and password (compose values) and the api's S3 credentials |
| `CHANNEL_TOKEN_KEY` | `platform` | base64 of 32 bytes: seals the connection credentials; preserve it for existing encrypted data |
| `OTP_PEPPER` | `platform` | the pepper of the loyalty code hashes |
| `N8N_SIGNING_SECRET` | `platform` | signs the n8n webhook calls |
| `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_BRIDGE_SECRET`, `OPENCLAW_TOOL_SECRET` | `openclaw` | the gateway token (api and gateway), the bridge plugin's signing secret and the per-turn tool token secret; the gateway container sees the first two through its least grant |
| `OPENROUTER_API_KEY`, `STARCI_AI_KEY` | `ai` (the owner's) | the AI gateway's upstream key and the virtual key the api and OpenClaw use |
| `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY` | `auth` (the owner's) | the api's access-token signing pair |

| Non-secret key | Value in dev |
| --- | --- |
| `PUBLIC_API_URL`, `AUTH_GOOGLE_CALLBACK_URL` | the api origin `http://localhost:18787` |
| `SITE_URL`, `AUTH_WEB_ORIGIN` | the console origin `http://localhost:3000` |
| `MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | the sealed dev member `mail`: the owner's own SMTP server, the same as production; `MAIL_PORT` (587), `MAIL_SECURITY` (starttls), `MAIL_FROM_NAME` (NIVO) and `MAIL_DEFAULT_LANGUAGE` (vi) are plain values of the api process. `MAIL_SUPPRESS` (plain, comma-separated patterns, default `*.example.test,*.example.com,*.invalid`) lists the recipients the platform sender never mails: the message is logged as `mail.suppressed` (recipient masked), kept in the dev outbox folder `MAIL_OUTBOX_DIR` (`${data}/mail-outbox`, set in the dev local block only) and the send answers success. Read it with `node dist/apps/cli/src/main.js mail outbox --to <address> --latest`. A pattern is an exact address, `*.domain` (the domain and its subdomains) or a bare domain. |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET_PREFIX` | `http://127.0.0.1:59000`, `nivo-dev` |
| `QUEUE_REDIS_HOST`, `QUEUE_REDIS_PORT`, `REALTIME_REDIS_URL` | the Redis container on `127.0.0.1:56379` |
| `AI_BASE_URL` | the api's in-process AI gateway, `http://127.0.0.1:18788/v1` (the OpenClaw container reaches it through `host.docker.internal`) |
| `OPENCLAW_GATEWAY_URL`, `OPENCLAW_CONFIG_DIR`, `OPENCLAW_MANAGE_AGENTS` | `ws://127.0.0.1:58790`, the agent workspace under the state base, `true` |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_DEVELOPER_API_URL` | `http://localhost:18787` |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_LANDING_URL`, `NEXT_PUBLIC_APP_URL` | the console `http://localhost:3000` and the landing `http://localhost:3002` |

## api: optional executable paths

These nonsecret keys select operator-installed executables. Omission retains the platform installation defaults. Paths must be absolute and local;
the executable and every parent directory must be unwritable by other users.

| Key | Semantics |
| --- | --- |
| `VIDEO_FFMPEG_PATH` | Optional trusted FFmpeg executable path. |
| `VIDEO_FFPROBE_PATH` | Optional trusted FFprobe executable path. |
| `VIDEO_NICE_PATH` | Optional trusted priority-lowering executable path, used when priority lowering is enabled. |
