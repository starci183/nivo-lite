# dev

Local development of NIVO runs Supabase in Supabase CLI-managed Docker containers (Postgres, Auth, Storage and Studio). Start Docker first, then start Supabase with `npm run db:start` from the repository root. `supabase/config.toml` owns the local Supabase configuration and ports. Starting Supabase does not start the api, console or landing: run them separately as host processes (`npm run dev:be`, `npm run dev:fe:web`, `npm run dev:fe:landing`) or as services from the declared `infra/swarm/stack.yaml` in a local single-manager Docker Swarm. Production has its own stack and runbook (`../production/README.md`).

The local stack needs no sealed secret: Supabase prints its own demo credentials. The api service reads them from the untracked file api.dev.env in this directory, which the stacks custody rules ignore. Use Supabase URLs that the service containers can reach; `host.docker.internal` points to the host gateway. Keep browser-facing Supabase URLs reachable from the browser.

Run commands from the repository root. Start Supabase, run `npm run codegen`, and write api.dev.env from `supabase status -o env`: `PRIMARY_DB_URL` for the `app_be` role, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHANNEL_TOKEN_KEY` and `N8N_SIGNING_SECRET` use local throwaway values. Export `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the local Supabase output for the web build. Run `npm run migrate` against the local database before deploying the services.

Swarm does not build images. Choose a registry reachable from the local Swarm, build and push all three images, and copy each pushed image's digest reference:

```sh
docker build -f be/apps/api/Dockerfile -t <registry>/nivo-lite-api:dev .
docker build -f fe/apps/web/Dockerfile -t <registry>/nivo-lite-web:dev \
    --build-arg NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY \
    --build-arg NEXT_PUBLIC_API_URL=http://api.localhost \
    --build-arg NEXT_PUBLIC_DEVELOPER_API_URL=http://api.localhost \
    --build-arg NEXT_PUBLIC_SITE_URL=http://localhost \
    --build-arg NEXT_PUBLIC_LANDING_URL=http://landing.localhost .
docker build -f fe/apps/landing/Dockerfile -t <registry>/nivo-lite-landing:dev \
    --build-arg NEXT_PUBLIC_SITE_URL=http://landing.localhost \
    --build-arg NEXT_PUBLIC_APP_URL=http://localhost .
docker push <registry>/nivo-lite-api:dev
docker push <registry>/nivo-lite-web:dev
docker push <registry>/nivo-lite-landing:dev
```

Create the untracked file dev.images.override.yaml at the repository root with the pushed image references. Replace `<registry>`, `<api-digest>`, `<web-digest>` and `<landing-digest>` with your registry and the actual 64-character SHA-256 digests. All three images must override the all-zero placeholders in the base stack:

```yaml
services:
  api:
    image: <registry>/nivo-lite-api@sha256:<api-digest>
  web:
    image: <registry>/nivo-lite-web@sha256:<web-digest>
  landing:
    image: <registry>/nivo-lite-landing@sha256:<landing-digest>
```

Deploy to the local Swarm manager:

```sh
docker stack config -c .starcistacks/dev/infra/swarm/stack.yaml -c dev.images.override.yaml | docker stack deploy -c - nivo-dev
```

`docker stack config` includes the local api.dev.env values in its output. Pipe it directly to deploy and keep that output out of shared logs. The one ingress publishes port 80 and routes by host: the api at `http://api.localhost`, the landing at `http://landing.localhost` and the web console at `http://localhost` (the catch-all). The `*.localhost` names resolve to the loopback address without a DNS record, and the stack serves plain HTTP, so no certificate exists. The api and landing Host rules take priority over the web catch-all.

| Command      | What it does                                                                                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| prepare      | Start Supabase, prepare api.dev.env, build and push the images, and write the digest override as described above.                                                                                                                                                |
| doctor       | `docker version`, `docker info` (check Swarm is active and this node is a manager), `supabase status`, and a check that ports 55321, 55322 and 80 are free or owned by this stack. Read-only.                                                              |
| up           | Migrate the local database, then run the `docker stack config` / `docker stack deploy` pipeline above; or start the host processes `npm run dev:be` and `npm run dev:fe:web`.                                                                                          |
| status       | `docker stack services nivo-dev`, `docker stack ps nivo-dev` and `supabase status`.                                                                                                                                                                                |
| logs         | `docker service logs -f nivo-dev_nivo-api`, `docker service logs -f nivo-dev_nivo-web-app` or `docker service logs -f nivo-dev_nivo-landing`.                                                                                                                                                                                    |
| down         | `docker stack rm nivo-dev` removes the app services; `supabase stop` stops the database.                                                                                                                                                                           |
| verification | `curl -fsS http://api.localhost/healthz`, `curl -fsS http://api.localhost/readyz` (the database answers), `curl -fsS http://localhost/health/live` (console) and `curl -fsS http://landing.localhost/health/live` (landing); then `npm run test` and the smoke steps of `be/docs/runbooks/cutover.md` against `http://localhost`. |
