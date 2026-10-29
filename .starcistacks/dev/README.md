# dev

Local development of NIVO uses Supabase CLI-managed Docker containers for PostgreSQL, Auth, Storage and Studio. The Supabase CLI project config owns the local project and ports. The native StarCi Supabase lifecycle applies its project, port and protected-stack policy; preserve a running stack when that owner refuses an operation. Starting Docker or Supabase does not configure or start the API, web console or landing. Production has its own stack and runbook (`../production/README.md`).

The API's required base settings are below. `be/apps/api/src/api.env.ts` composes the typed config readers; missing or malformed inputs fail boot. Optional integrations can require additional settings when enabled, so this list is not proof that an arbitrary supplied configuration is ready.

| Setting | Local API requirement |
| --- | --- |
| `PORT` | Integer listener port from the selected application placement. |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | Comma-separated canonical browser origins permitted by the HTTP security reader. |
| `PRIMARY_DB_URL` | Private connection to the local database as the least-privilege `app_be` role, with its existing matching password. The administrative `postgres` connection is not the application credential. |
| `PRIMARY_DB_SCHEMA` | Nonempty application schema name from the selected database configuration. |
| `CHANNEL_TOKEN_KEY` | Private base64 value that decodes to exactly 32 bytes; preserve it for existing encrypted connection data. |
| `OTP_PEPPER` | Independent private pepper of at least 32 characters for loyalty code hashes. |
| `SITE_URL` | Absolute public origin of the local web app, used for provider return addresses. |
| `N8N_SIGNING_SECRET` | Nonempty private signing secret; it must match any enabled n8n workflow consumer. |

Supply private values through the existing native custody owner, never chat, command arguments or shared logs. Sealed application custody belongs in `.starcistacks/<env>/secrets/<slug>.enc`; the API's `EnvSource` prefers the corresponding `<NAME>_FILE` input and fails if that file cannot be read. Existing local keys must be retained; fresh keys belong only to an explicitly initialized fresh environment. Do not substitute production custody for a missing local binding.

The tracked `infra/swarm/stack.yaml` recipe declares an externally supplied legacy API environment input. That declaration does not create, supply or validate the input. Existing `starci app secret` commands can manage and materialize sealed values, but they do not assemble this complete API input, initialize the `app_be` password, or adopt a protected Supabase stack. Native status output and a successful secret-shape check do not establish those steps or application readiness.

Use component-specific endpoints: host application processes reach local dependencies through their published loopback ports, while service containers need the declared reachable host gateway. The browser-facing api origin must remain browser-reachable. The web app receives only its public `NEXT_PUBLIC_*` build settings and signs in through the api's `/auth` doors; the database URL and the sign-in signing keys remain backend-only.

After the selected local configuration and database migration state are verified, the existing package scripts can run the application processes (`npm run dev:be:api`, `npm run dev:fe:web`, `npm run dev:fe:landing`), or the declared Swarm recipe can run the services. These scripts consume configuration; they are not a local credential bootstrap. Run repository commands from the application root and retain separate liveness, database readiness and browser verification.

Swarm does not build images. Choose a registry reachable from the local Swarm, build and push all four images, and copy each pushed image's digest reference:

```sh
docker build -f be/apps/api/Dockerfile -t <registry>/nivo-lite-api:dev .
docker build -f be/apps/mcp/Dockerfile -t <registry>/nivo-lite-mcp:dev .
docker build -f fe/apps/web/Dockerfile -t <registry>/nivo-lite-web:dev \
    --build-arg NEXT_PUBLIC_API_URL=http://api.localhost \
    --build-arg NEXT_PUBLIC_DEVELOPER_API_URL=http://api.localhost \
    --build-arg NEXT_PUBLIC_SITE_URL=http://localhost \
    --build-arg NEXT_PUBLIC_LANDING_URL=http://landing.localhost .
docker build -f fe/apps/landing/Dockerfile -t <registry>/nivo-lite-landing:dev \
    --build-arg NEXT_PUBLIC_SITE_URL=http://landing.localhost \
    --build-arg NEXT_PUBLIC_APP_URL=http://localhost .
docker push <registry>/nivo-lite-api:dev
docker push <registry>/nivo-lite-mcp:dev
docker push <registry>/nivo-lite-web:dev
docker push <registry>/nivo-lite-landing:dev
```

Create the untracked file dev.images.override.yaml at the repository root with the pushed image references. Replace `<registry>`, `<api-digest>`, `<mcp-digest>`, `<web-digest>` and `<landing-digest>` with your registry and the actual 64-character SHA-256 digests. All four images must override the all-zero placeholders in the base stack:

```yaml
services:
  nivo-api:
    image: <registry>/nivo-lite-api@sha256:<api-digest>
  nivo-mcp:
    image: <registry>/nivo-lite-mcp@sha256:<mcp-digest>
  nivo-web-app:
    image: <registry>/nivo-lite-web@sha256:<web-digest>
  nivo-landing:
    image: <registry>/nivo-lite-landing@sha256:<landing-digest>
```

Deploy to the local Swarm manager:

```sh
docker stack config -c .starcistacks/dev/infra/swarm/stack.yaml -c dev.images.override.yaml | docker stack deploy -c - nivo-dev
```

`docker stack config` includes the local api.dev.env values in its output. Pipe it directly to deploy and keep that output out of shared logs. The one ingress publishes port 80 and routes by host: the api at `http://api.localhost`, the landing at `http://landing.localhost` and the web console at `http://localhost` (the catch-all). The `*.localhost` names resolve to the loopback address without a DNS record, and the stack serves plain HTTP, so no certificate exists. The api and landing Host rules take priority over the web catch-all. The MCP gateway (`nivo-mcp`) carries no Traefik label: it is internal only, reached as `http://nivo-mcp:8790` from the other services of the stack, and its own healthcheck probes `/healthz`.

| Command      | What it does                                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| prepare      | Start Supabase, prepare api.dev.env, build and push the images, and write the digest override as described above.                                                                                                                                                |
| doctor       | `docker version`, `docker info` (check Swarm is active and this node is a manager), `supabase status`, and a check that ports 55321, 55322 and 80 are free or owned by this stack. Read-only.                                                              |
| up           | Migrate the local database, then run the `docker stack config` / `docker stack deploy` pipeline above; or start the host processes `npm run dev:be:api` and `npm run dev:fe:web`.                                                                                          |
| status       | `docker stack services nivo-dev`, `docker stack ps nivo-dev` and `supabase status`.                                                                                                                                                                                |
| logs         | `docker service logs -f nivo-dev_nivo-api`, `docker service logs -f nivo-dev_nivo-web-app` or `docker service logs -f nivo-dev_nivo-landing`.                                                                                                                                                                                    |
| down         | `docker stack rm nivo-dev` removes the app services; `supabase stop` stops the database.                                                                                                                                                                           |
| verification | `curl -fsS http://api.localhost/healthz`, `curl -fsS http://api.localhost/readyz` (the database answers), `curl -fsS http://localhost/health/live` (console) and `curl -fsS http://landing.localhost/health/live` (landing); then `npm run test` and the smoke steps of `be/docs/runbooks/cutover.md` against `http://localhost`. |
