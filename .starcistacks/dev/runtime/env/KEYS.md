# Environment keys (development)

Names only. Local development has no sealed member: the operator writes the local database URL and the local keys to the untracked
`.starcistacks/dev/api.dev.env`. The api reads the same keys as in production (see the production KEYS.md); the public build values below are the
local ones.

| Key | Semantics |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | The api origin, `http://api.localhost`. |
| `NEXT_PUBLIC_DEVELOPER_API_URL` | The api origin, `http://api.localhost`. |
| `NEXT_PUBLIC_SITE_URL` | The console `http://localhost` and the landing `http://landing.localhost`. |
| `NEXT_PUBLIC_LANDING_URL` | The console `http://localhost` and the landing `http://landing.localhost`. |
| `NEXT_PUBLIC_APP_URL` | The console `http://localhost` and the landing `http://landing.localhost`. |

## api: local secrets and origins

| Key | Semantics |
| --- | --- |
| `PUBLIC_API_URL` | The local api origin (`http://api.localhost`): plain http is accepted only for a loopback host; the agents' tool door is `<origin>/agent-tools`. |
| `AUTH_WEB_ORIGIN` | The local console origin (`http://localhost`) the own auth returns browsers to. |
| `AUTH_GOOGLE_CALLBACK_URL` | The local Google callback (`http://api.localhost/auth/google/callback`). |
| `STORAGE_ENDPOINT` | The local S3 address of the operator's MinIO (`http://host.docker.internal:9000` from the container (`http://localhost:9000` natively)); not a secret. |
| `STORAGE_BUCKET_PREFIX` | `nivo-dev`: the prefix of the local buckets. |
| `OPENCLAW_TOOL_SECRET` | Read only through `OPENCLAW_TOOL_SECRET_FILE` (a file outside the repository, never plaintext env): signs the per-turn tool token; without it a turn of an agent holding connector grants answers `tools_not_configured`. |

## api: optional executable paths

These nonsecret keys select operator-installed executables. Omission retains the platform installation defaults. Paths must be absolute and local; the executable and every parent directory must be unwritable by untrusted users. PATH is never searched.

| Key | Semantics |
| --- | --- |
| `VIDEO_FFMPEG_PATH` | Optional trusted FFmpeg executable path. |
| `VIDEO_FFPROBE_PATH` | Optional trusted FFprobe executable path. |
| `VIDEO_NICE_PATH` | Optional trusted priority-lowering executable path, used when priority lowering is enabled. |
