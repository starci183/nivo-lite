# dev

The dev environment of NIVO is one command: `starci app stack up --env dev --execute`. It checks the machine, opens the dev custody, runs the
setup (`npm ci` when `node_modules` is absent, then codegen), starts PostgreSQL (the managed `db` image, pgvector), Redis, MinIO and the OpenClaw
gateway in Docker Linux containers, gives the environment its own database role, migrates, starts the api, the mcp gateway, the console and the
landing natively, waits for readiness and prints the origins. What it runs is the `local` block of `environments.dev` in
`.starcistacks/application-stacks.yaml` and `infra/compose/compose.yaml` (PROJECT-STACKS-6 in contexts/project/stacks.md of the harness); this
runbook carries no docker command and nobody runs docker by hand.

| Component | Where | Host port (loopback) |
| --- | --- | --- |
| db (PostgreSQL 17, pgvector) | container, volume `db-data` | 54332 |
| redis (BullMQ broker, realtime) | container, volume `redis-data` | 56379 |
| minio (S3) | container, volume `minio-data` | 59000 |
| openclaw (agent gateway, relay) | container, agent workspace under the state base | 58790 |
| api (+ the AI gateway on port + 1) | native | 18787 (gateway 18788) |
| mcp | native | 18790 |
| web (console) | native | 3000 |
| landing | native | 3002 |

The ports differ from production and from the earlier local containers (`nivo-lite-dev-db` on 54322, port 8787) on purpose: `doctor` reports a port
that something else holds and names the holder. Change a port in `local.ports` of the manifest, not in the commands.

**Custody.** Dev values are sealed like any secret. `starci app secret init --env dev --execute` creates the dev-only ones once (members `db`,
`storage`, `platform`, `openclaw`) and never replaces a sealed value; the owner's members `ai` (`OPENROUTER_API_KEY`, `STARCI_AI_KEY`) and `auth`
(the JWT pair) are read as they are. A machine without the age identity the members are sealed to is refused with the owner step to obtain it. The
database is a container of its own compose project: the migrations run as the role `nivo_lite_dev` and the api connects as `app_be` with a password
of this environment alone, so no role is shared with another environment or server.

**A new machine.** Run `starci app stack doctor --env dev`: it prints one row per prerequisite (Node 22, npm, git, Docker with Compose v2, WSL2 on
Windows, sops and age, disk, memory, the ports) and, for each missing one, the exact winget, brew or apt step for the owner to run. Then
`starci app stack up --env dev --execute`.

| Command | Operation |
| --- | --- |
| prepare | `starci app stack prepare --env dev --execute`: checks the machine, opens the custody, runs the setup and builds or pulls the images. |
| doctor | `starci app stack doctor --env dev`: read-only table of the host prerequisites with the owner-run install step per OS, the custody, the compose render and the ports. |
| up | `starci app stack up --env dev --execute`: prepare, then the services and their health, the database role, the migrations with a receipt, the processes and readiness; prints the origins. |
| status | `starci app stack status --env dev`: desired against running, the migration receipt and every readiness probe. |
| logs | `starci app stack logs --env dev --service api` (api, mcp, web, landing, or db, nivo-redis, nivo-minio, nivo-openclaw; bounded and redacted). |
| down | `starci app stack down --env dev --execute`: ends the processes and stops the compose project; volumes and sealed values stay. |
| verification | `starci app stack verify --env dev`: the api `/healthz` and `/readyz` (the database answers), the console and the landing `/health/live`; then `npm run test` and the acceptance flows against the printed origins. |

The volumes are rebuildable development data: `starci app db migrate` recreates the schema from `db/bootstrap.sql` and `db/migrations`; the
OpenClaw workspace lives under the state base (`STARCI_LOCAL_ROOT`) and `down` keeps it. Key names are in `runtime/env/KEYS.md`.
