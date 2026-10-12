# The VPS stack

One Ubuntu VPS runs four Compose projects, each with its own deploy workflow so that none recreates another:

| Project (folder)                | What                                                                             | Deploy                                   |
| ------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| `nivo-edge` (`~/nivo-edge`)     | Traefik: owns 80/443 and the Let's Encrypt certificates; routes by host and path | `edge-deploy.yml`, source `deploy/edge/` |
| `nivo-engine` (`~/nivo-engine`) | the **api**, `openclaw`, `n8n` (with its own Postgres) and an optional `caddy`   | `api-deploy.yml`, source `deploy/stack/` |
| `nivo-web` (`~/nivo-web`)       | the Next.js app                                                                  | `web-deploy.yml`, source `deploy/web/`   |
| `namnivo`                       | a second product that shares the edge                                            | its own repository                       |

The stack project keeps the name `nivo-engine` from the time the api was the engine: Compose prefixes volume names with the project name
(`nivo-engine_openclaw-data`, `nivo-engine_n8n-db`, ...), and renaming it would orphan them. Nothing in the repository runs on the machine by
itself: the workflows are started by hand, and the one-time steps below are done once when the VPS is first set up.

## 0. What you provide

| Need                      | Notes                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ubuntu 22.04 or 24.04 VPS | At least 2 vCPU, 4 GB RAM, 40 GB SSD for the start (OpenClaw + n8n + Postgres + api). 8 GB when many agents run in parallel. Public IPv4.                                                                |
| Domain                    | A records for `api.<domain>`, `n8n.<domain>` and the product hosts pointing at the VPS **before** the first run, so the edge can obtain certificates. `engine.<domain>` stays as the legacy health host. |
| SSH access                | A non-root user, key login, member of the `docker` group. The CI deploy key is authorised by the `authorize-deploy-key.yml` workflow.                                                                    |
| Supabase                  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the `PRIMARY_DB_URL` of the least-privilege role `app_be` (the platform migration is applied).                                                           |
| OpenClaw                  | The public image `ghcr.io/openclaw/openclaw`; if your tag needs a licence or a private registry, provide it. Pin a tested tag.                                                                           |
| Model key                 | The provider key the OpenClaw agents use (OpenRouter, Anthropic, OpenAI or DeepSeek).                                                                                                                    |
| Generated secrets         | `OPENCLAW_GATEWAY_TOKEN`, `N8N_ENCRYPTION_KEY` (`openssl rand -hex 32`) and `N8N_DB_PASSWORD`.                                                                                                           |

## 1. Ports and firewall

| Port                                 | Listener                        | Public?                                                                          |
| ------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------- |
| 22/tcp                               | sshd                            | Yes (SSH only)                                                                   |
| 80/tcp, 443/tcp, 443/udp             | Traefik (or the optional caddy) | Yes (80 is for Let's Encrypt and the redirect to HTTPS)                          |
| 127.0.0.1:18789                      | OpenClaw gateway                | **No** (loopback only; reach the Control UI through an SSH tunnel)               |
| 8787 (inside the openclaw namespace) | api                             | Published on the docker bridge address (`API_BIND=172.29.0.1`) for the edge only |
| 5678                                 | n8n                             | Published on the docker bridge address (`N8N_BIND`) for the edge only            |
| 5432                                 | n8n-db                          | Compose network only                                                             |

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable
```

**Important:** Docker publishes ports with its own iptables rules and **bypasses UFW**. Safety therefore comes from the Compose files, not from UFW: only the
edge publishes 80/443, `openclaw` publishes `127.0.0.1:18789` and the api and n8n ports bind to the bridge address or loopback. Do not add public `ports:` to n8n, n8n-db
or the api. After a deploy, check from another machine: `nmap -Pn <ip>` must show only 22, 80 and 443.

Harden SSH (`/etc/ssh/sshd_config`): `PermitRootLogin no`, `PasswordAuthentication no`; consider `fail2ban`.

## 2. Install Docker (once)

Follow the official guide for Ubuntu (https://docs.docker.com/engine/install/ubuntu/), then `sudo usermod -aG docker $USER` and sign in again. Docker Compose v2 is required.
Create the shared network once: `docker network create nivo-edge`.

## 3. The two environment files of the stack

The api workflow writes them from GitHub secrets; to bootstrap by hand, create them in `~/nivo-engine/deploy` with mode 600:

- `.env` from `deploy/stack/.env.example`: OpenClaw, n8n, binds, watchdog thresholds, and `API_TAG` (the image tag).
- `api.env` from `deploy/stack/api.env.example`: the runtime environment of the api only (database role, Supabase, allowed origins, provider and knowledge keys).

They hold full-access keys: never commit them or send them in chat, and keep a copy in a password manager. Losing `N8N_ENCRYPTION_KEY` means entering every credential in n8n again.
`node scripts/env-sync.mjs` builds `ENGINE_ENV` (the first file), `API_ENV` (the second) and `WEB_ENV` from the one local `secrets.env`.

## 4. Deploy

Run the workflow **Deploy api** (Actions > Deploy api > Run workflow). It builds the image on the runner, ships it, swaps the release folder, starts the stack, waits for the api
to be healthy and for `/readyz` to answer, and restores the previous release when it does not. A manual deploy without GitHub is the same sequence by hand:

```bash
docker save nivo-api:<tag> | gzip | ssh <vps> 'gunzip | docker load'
# upload deploy/stack/ to ~/nivo-engine/deploy, write .env (with API_TAG=<tag>) and api.env there, then on the VPS:
cd ~/nivo-engine/deploy && docker compose --env-file .env config -q && docker compose --env-file .env up -d --remove-orphans
```

## 5. After the first run

1. **n8n**: open `https://n8n.<domain>` and create the owner account at once (the first person in becomes the owner). Setting `N8N_ALLOWED_CIDRS` to your own address is advised for the first run. Create a workflow with a Webhook node on the path `nivo-events` so it matches `N8N_DEFAULT_WEBHOOK_URL`.
2. **OpenClaw**: configure the model provider and create the agents. Control UI through a tunnel: `ssh -L 18789:127.0.0.1:18789 deploy@<ip>`, then open `http://127.0.0.1:18789`. The api uses the agent `ws-<first 8 characters of the workspace id>-chatbot` for each workspace (or turn on `OPENCLAW_MANAGE_AGENTS=1` after verifying the schema).
3. **Check**: `curl https://api.<domain>/health/live` answers `{"status":"ok",...}`, and `curl https://engine.<domain>/healthz` still does. Send a test message through a connected channel.
4. `docker compose --env-file .env logs -f api` shows the jobs running. Queue design and operation: `be/docs/guides/jobs.md` and `be/docs/runbooks/jobs-operations.md`.

If the api stops, the apps fall back to their direct processors when no heartbeat arrives within 90 seconds, so customers do not wait.

## 6. Backup

State lives in the volumes: `n8n-db` (n8n's Postgres), `n8n-data`, `openclaw-data` (configuration, agents, sessions), `caddy-data` and `caddy-config` (when caddy is used) and `video-cache` (a cache, disposable). The
job queues (pgmq, the outbox and the claims) are in Supabase and covered by its backups. The api keeps no local state.

```bash
cd ~/nivo-engine/deploy
BACKUP_DIR=/var/backups/nivo-engine ./backup.sh            # pg_dump of n8n + tar of the volumes, keeps 14 days
# nightly cron at 02:30:
# 30 2 * * * cd ~/nivo-engine/deploy && BACKUP_DIR=/var/backups/nivo-engine ./backup.sh >> /var/log/nivo-backup.log 2>&1
```

The same VPS is not an independent backup: **copy `BACKUP_DIR` elsewhere** (rclone to object storage, or another machine). Keep the env files in a password manager. Restore: bring up a new stack,
`docker compose stop n8n`, load `pg_restore -U n8n -d n8n --clean` into `n8n-db`, unpack the tarballs into the matching volumes, then `up -d`. **Try a restore on a test machine before you trust a backup.**

## 7. Update and roll back

- Update the api: run **Deploy api** again. The api receives SIGTERM, waits up to 30 seconds for running jobs and hands the rest back to the queue.
- Change the OpenClaw or n8n tag: edit `OPENCLAW_TAG` / `N8N_TAG` in `ENGINE_ENV` (or `.env`) and deploy. n8n migrates its database on start: **back up first**; a migrated database cannot go back.
- Roll back the api: an unhealthy deploy restores `~/nivo-engine.prev` by itself. To go back to an older tag later, set `API_TAG` in `.env` to a tag whose image is still on the host and `docker compose --env-file .env up -d`. SQL migrations only move forward (write a new migration instead of editing an applied one).

## 8. Quick troubleshooting

| Symptom                            | Check                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The api does not answer            | `docker compose ps`; `docker compose logs api`; are `PRIMARY_DB_URL` and `SUPABASE_*` right (a missing key stops the boot with its name)                                                         |
| Every turn is a `direct_fallback`  | `logs api` for `OpenClaw failed (...)`: wrong token (`NOT_PAIRED`), missing scope (`missingScope`: the api must be in `network_mode: service:openclaw`), the agent does not exist, timeout       |
| The edge cannot get a certificate  | DNS does not point at the VPS yet, or ports 80/443 are blocked                                                                                                                                   |
| Webhooks answer 401                | the provider's webhook secret differs between the provider and `api.env`, or the VPS clock is off by more than 5 minutes (`timedatectl`)                                                         |
| Every client shares one rate limit | the proxy hop is not trusted: check that the api runs behind exactly one proxy (the edge)                                                                                                        |
| A job is `failed`                  | `./jobs.sh failed` or `select id, name, state, attempts, last_error from job_outbox where state = 'failed' order by finished_at desc limit 20;`                                                  |
| A document stays "Waiting"         | `./jobs.sh open`, or `select name, state, attempts, last_error from job_outbox where state in ('queued','running');`; `job_stats()` shows a large `oldestQueuedAgeSeconds` when nothing consumes |
| Jobs fail in bulk                  | `./jobs.sh failed`, then resend with `./jobs.sh retry <outbox id>` (see `be/docs/runbooks/jobs-operations.md`)                                                                                   |
