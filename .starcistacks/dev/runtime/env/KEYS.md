# Environment keys (development)

Names only. Local development has no sealed member: the Supabase CLI prints its own demo credentials and the operator writes them to the untracked
`.starcistacks/dev/api.dev.env`. The api reads the same keys as in production (see the production KEYS.md); the public build values below are the
local ones.

| Key | Semantics |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The local Supabase origin and anonymous key (from `supabase status -o env`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The local Supabase origin and anonymous key (from `supabase status -o env`). |
| `NEXT_PUBLIC_API_URL` | The api origin, `http://api.localhost`. |
| `NEXT_PUBLIC_DEVELOPER_API_URL` | The api origin, `http://api.localhost`. |
| `NEXT_PUBLIC_SITE_URL` | The console `http://localhost` and the landing `http://landing.localhost`. |
| `NEXT_PUBLIC_LANDING_URL` | The console `http://localhost` and the landing `http://landing.localhost`. |
| `NEXT_PUBLIC_APP_URL` | The console `http://localhost` and the landing `http://landing.localhost`. |

## api: local secrets and origins

| Key | Semantics |
| --- | --- |
| `PUBLIC_API_URL` | The local api origin (`http://api.localhost`): plain http is accepted only for a loopback host; the agents' tool door is `<origin>/agent-tools`. |
| `OPENCLAW_TOOL_SECRET` | Read only through `OPENCLAW_TOOL_SECRET_FILE` (a file outside the repository, never plaintext env): signs the per-turn tool token; without it a turn of an agent holding connector grants answers `tools_not_configured`. |

## api: optional executable paths

These nonsecret keys select operator-installed executables. Omission retains the platform installation defaults. Paths must be absolute and local; the executable and every parent directory must be unwritable by untrusted users. PATH is never searched.

| Key | Semantics |
| --- | --- |
| `VIDEO_FFMPEG_PATH` | Optional trusted FFmpeg executable path. |
| `VIDEO_FFPROBE_PATH` | Optional trusted FFprobe executable path. |
| `VIDEO_NICE_PATH` | Optional trusted priority-lowering executable path, used when priority lowering is enabled. |
