# dev

Local development of NIVO: the local Supabase (`supabase start`, the Supabase CLI stack: Postgres, Auth, Storage, Studio) plus the be and the fe, either as host processes (`npm run dev:be`, `npm run dev:fe`) or as containers from `compose.yaml`. The runtime is Docker Compose. Production is a different runtime (Docker Swarm, `../production/README.md`).

The local stack needs no sealed secret: Supabase prints its own demo credentials. The api container reads them from the untracked `api.dev.env`, which the stacks custody rules ignore (`.starcistacks/**` is denied except the listed re-includes).

| Command | What it does |
| --- | --- |
| prepare | `npm ci`, `npm run codegen`, `supabase start`, then write `api.dev.env` from `supabase status -o env` (`PRIMARY_DB_URL` for the `app_be` role, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHANNEL_TOKEN_KEY`, `N8N_SIGNING_SECRET`: local throwaway values) and `export NEXT_PUBLIC_SUPABASE_ANON_KEY` for the web build. |
| doctor | `docker version`, `docker compose version`, `supabase status`, and a check that ports 54321, 54322, 8787 and 3000 are free or owned by this stack. Read-only. |
| up | `npm run migrate` against the local database, then `docker compose -f .starcistacks/dev/compose.yaml up --build -d`; or the host processes `npm run dev:be` and `npm run dev:fe`. |
| status | `docker compose -f .starcistacks/dev/compose.yaml ps` and `supabase status`. |
| logs | `docker compose -f .starcistacks/dev/compose.yaml logs -f api web`. |
| down | `docker compose -f .starcistacks/dev/compose.yaml down` (volumes stay); `supabase stop` stops the database. |
| verification | `curl -fsS http://localhost:8787/healthz`, `curl -fsS http://localhost:8787/readyz` (the database answers) and `curl -fsS http://localhost:3000/health/live`; then `npm run test` and the smoke steps of `be/docs/runbooks/cutover.md` against `http://localhost`. |
