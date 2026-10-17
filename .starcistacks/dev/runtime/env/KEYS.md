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
