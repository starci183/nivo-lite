# The VPS stack

One Ubuntu VPS runs four Compose projects, each with its own deploy workflow so that none recreates another:

| Project (folder)                | What                                                                             | Deploy                                   |
| ------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| `nivo-edge` (`~/nivo-edge`)     | Traefik: owns 80/443 and the Let's Encrypt certificates; routes by host and path | `edge-deploy.yml`, source `deploy/edge/` |
| `nivo-engine` (`~/nivo-engine`) | the **api**, `openclaw` and `n8n` (with its own Postgres)                        | `api-deploy.yml`, source `deploy/stack/` |
| `nivo-web` (`~/nivo-web`)       | the Next.js app                                                                  | `web-deploy.yml`, source `deploy/web/`   |
| `namnivo`                       | a second product that shares the edge                                            | its own repository                       |

The stack project keeps the name `nivo-engine` from the time the api was the engine: Compose prefixes volume names with the project name
(`nivo-engine_openclaw-data`, `nivo-engine_n8n-db`, ...), and renaming it would orphan them. Nothing in the repository runs on the machine by
itself (the one exception today is the `watchdog.sh` line that Deploy api installs in the `nivo` crontab; the lite/swarm migration removes it, see `stack-deploy.yml` on that branch): the workflows are started by hand, and the one-time steps below are done once when the VPS is first set up.

## 0. What you provide

| Need                      | Notes                                                                                                                                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ubuntu 22.04 or 24.04 VPS | At least 2 vCPU, 4 GB RAM, 40 GB SSD for the start (OpenClaw + n8n + Postgres + api). 8 GB when many agents run in parallel. Public IPv4.                                                                                                            |
| Domain                    | A records for `nivo.vn`, `www.nivo.vn` and `api.nivo.vn` pointing at the VPS **before** the first run, so the edge can obtain certificates (the zone is at Tino; `be/docs/runbooks/dns-rollback.md`). `n8n.`, `engine.` and `app-vps.` are optional. |
| SSH access                | A non-root user, key login, member of the `docker` group. The CI deploy key is authorised by the `authorize-deploy-key.yml` workflow.                                                                                                                |
| Supabase                  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the `PRIMARY_DB_URL` of the least-privilege role `app_be` (the platform migration is applied).                                                                                                       |
| OpenClaw                  | The public image `ghcr.io/openclaw/openclaw`; if your tag needs a licence or a private registry, provide it. Pin a tested tag.                                                                                                                       |
| Model key                 | The provider key the OpenClaw agents use (OpenRouter, Anthropic, OpenAI or DeepSeek).                                                                                                                                                                |
| Generated secrets         | `OPENCLAW_GATEWAY_TOKEN`, `N8N_ENCRYPTION_KEY` (`openssl rand -hex 32`) and `N8N_DB_PASSWORD`.                                                                                                                                                       |

## 1. Ports and firewall

| Port                                 | Listener         | Public?                                                                                     |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------- |
| 22/tcp                               | sshd             | Yes (SSH only)                                                                              |
| 80/tcp, 443/tcp, 443/udp             | Traefik          | Yes (80 is for Let's Encrypt and the redirect to HTTPS)                                     |
| 127.0.0.1:18789                      | OpenClaw gateway | **No** (loopback only; reach the Control UI through an SSH tunnel)                          |
| 8787 (inside the openclaw namespace) | api              | Published on the docker bridge address (`API_BIND`, default `172.29.0.1`) for the edge only |
| 127.0.0.1:5678                       | n8n              | **No** (loopback only; editor through an SSH tunnel)                                        |
| 5432                                 | n8n-db           | Compose network only                                                                        |

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
sudo ufw enable
```

**Important:** Docker publishes ports with its own iptables rules and **bypasses UFW**. Safety therefore comes from the Compose files, not from UFW: only the
edge publishes 80/443, `openclaw` publishes `127.0.0.1:18789`, n8n binds to loopback and the api port binds to the bridge address. Do not add public `ports:` to n8n, n8n-db
or the api. After a deploy, check from another machine: `nmap -Pn <ip>` must show only 22, 80 and 443.

Harden SSH (`/etc/ssh/sshd_config`): `PermitRootLogin no`, `PasswordAuthentication no`; consider `fail2ban`.

## 2. Install Docker (once)

Follow the official guide for Ubuntu (https://docs.docker.com/engine/install/ubuntu/), then `sudo usermod -aG docker $USER` and sign in again. Docker Compose v2 is required.
Create the shared network once: `docker network create nivo-edge`.

## 3. Configuration and secrets of the stack

Nothing secret is kept as an env file on the VPS or in GitHub. The sealed files `.starcistacks/production/secrets/{api,auth,stack}.enc` are decrypted in the deploy job with `SOPS_AGE_KEY` (a protected GitHub environment secret) by `deploy/materialize.mjs` and written, per key, to `~/nivo-engine/deploy/secrets/{api,stack}` (read-only bind mounts at `/run/secrets`); the containers read `<NAME>_FILE`. Beside them the job writes:

- `.env` (compose interpolation, non-secret): the stack settings of `stack.enc` (`OPENCLAW_*` tags and model, `N8N_TAG`, `API_BIND`, watchdog thresholds; `deploy/stack/.env.example`) plus `API_TAG`.
- `api.env`: only `<KEY>_FILE` pointer lines (names and paths) for the api. The committed non-secret production config is `deploy/stack/api-public.conf`; the names the api reads are listed in `deploy/stack/api.env.example`.
- `openclaw.env` (mode 600): OpenClaw's gateway token and model provider keys, the one place a value is an environment variable, because the OpenClaw image has no `_FILE` support.

To bootstrap by hand, run `SOPS_AGE_KEY=... node deploy/materialize.mjs files --env production --out <dir>` and copy the folder content to `~/nivo-engine/deploy` (`secrets/` next to `api.env`, `openclaw.env`, `.env`). Losing `N8N_ENCRYPTION_KEY` means entering every credential in n8n again: it lives only in the sealed `stack` file, which is backed up with the age identity (`secret.env`). After the canon repin `starci app secret materialize` replaces `deploy/materialize.mjs`.

## 4. Deploy

Run the workflow **Deploy api** (Actions > Deploy api > Run workflow). It builds the image on the runner, ships it, swaps the release folder, starts the stack, waits for the api
to be healthy and for `/readyz` to answer, and restores the previous release when it does not. A manual deploy without GitHub is the same sequence by hand:

```bash
docker save nivo-api:<tag> | gzip | ssh <vps> 'gunzip | docker load'
# upload deploy/stack/ to ~/nivo-engine/deploy, add the materialized secrets/, api.env, openclaw.env and .env (with API_TAG=<tag>), then on the VPS:
cd ~/nivo-engine/deploy && docker compose --env-file .env config -q && docker compose --env-file .env up -d --remove-orphans
```

## 5. After the first run

1. **n8n** is private: open an SSH tunnel (`ssh -L 5678:127.0.0.1:5678 deploy@<ip>`), browse `http://127.0.0.1:5678` and create the owner account at once (the first person in becomes the owner). Create a workflow with a Webhook node on the path `nivo-events` so it matches `N8N_WEBHOOK_BASE` (`http://n8n:5678/webhook/nivo-events`). To publish n8n later, follow the optional entries in `deploy/edge/dynamic/routes.yml` (DNS at Tino first).
2. **OpenClaw**: configure the model provider and create the agents. Control UI through a tunnel: `ssh -L 18789:127.0.0.1:18789 deploy@<ip>`, then open `http://127.0.0.1:18789`. The api uses the agent `ws-<first 8 characters of the workspace id>-chatbot` for each workspace (or turn on `OPENCLAW_MANAGE_AGENTS=true` after verifying the schema).
3. **Check**: `curl https://api.nivo.vn/healthz` answers from the api. Send a test message through a connected channel.
4. `docker compose --env-file .env logs -f api` shows the jobs running. Queue design and operation: `be/docs/guides/jobs.md` and `be/docs/runbooks/jobs-operations.md`.

If the api stops, the apps fall back to their direct processors when no heartbeat arrives within 90 seconds, so customers do not wait.

## 6. Backup

State lives in the volumes: `n8n-db` (n8n's Postgres), `n8n-data`, `openclaw-data` (configuration, agents, sessions) and `video-cache` (a cache, disposable). The
job queues (pgmq, the outbox and the claims) are in Supabase and covered by its backups. The api keeps no local state.

```bash
cd ~/nivo-engine/deploy
BACKUP_DIR=/var/backups/nivo-engine ./backup.sh            # encrypted pg_dump of n8n + encrypted tar of the n8n and OpenClaw volumes, keeps 14 days
# nightly cron at 02:30:
# 30 2 * * * cd ~/nivo-engine/deploy && BACKUP_DIR=/var/backups/nivo-engine ./backup.sh >> /var/log/nivo-backup.log 2>&1
```

Every backup is encrypted with `age` to the project recipient (`deploy/stack/backup.recipient`, the public key of `.sops.yaml`) while it is produced: the data flows from `pg_dump` / `tar` straight through `age` into `*.age` files, so no plaintext dump or tarball is ever written on the VPS, and a failed dump leaves no file. Install `age` once (`sudo apt install age`). The private identity (`SOPS_AGE_KEY` in the owner's `.claude/secret.env`) is never on the VPS, so only the owner can open a backup; losing that key loses the backups, exactly like the sealed secrets.

The same VPS is not an independent backup: **copy `BACKUP_DIR` elsewhere** (rclone to object storage, or another machine; the files are safe to copy). The age identity (`secret.env`) is the only other thing to keep safe: every secret is rebuilt from the sealed files. Restore on the owner's machine with the identity loaded in the environment: `age -d -i <(printf '%s' "$SOPS_AGE_KEY") n8n-db-<stamp>.dump.age`, pipe it into `pg_restore -U n8n -d n8n --clean` in `n8n-db` (after `docker compose stop n8n`), unpack the volume archives the same way into the matching volumes, then `up -d`. **Try a restore on a test machine before you trust a backup.**

## 7. Update and roll back

- Update the api: run **Deploy api** again. The api receives SIGTERM, waits up to 30 seconds for running jobs and hands the rest back to the queue.
- Change the OpenClaw or n8n tag: edit `OPENCLAW_TAG` / `N8N_TAG` in the sealed `stack` file (`starci app secret set production stack ...`) and deploy. n8n migrates its database on start: **back up first**; a migrated database cannot go back.
- Roll back the api: an unhealthy deploy restores `~/nivo-engine.prev` by itself. To go back to an older tag later, set `API_TAG` in `.env` to a tag whose image is still on the host and `docker compose --env-file .env up -d`. SQL migrations only move forward (write a new migration instead of editing an applied one).

## 8. Quick troubleshooting

| Symptom                            | Check                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The api does not answer            | `docker compose ps`; `docker compose logs api`; are `PRIMARY_DB_URL` and `SUPABASE_*` sealed in `api.enc` and listed in `secrets/api` (a missing key stops the boot with its name)               |
| Every turn is a `direct_fallback`  | `logs api` for `OpenClaw failed (...)`: wrong token (`NOT_PAIRED`), missing scope (`missingScope`: the api must be in `network_mode: service:openclaw`), the agent does not exist, timeout       |
| The edge cannot get a certificate  | DNS of `nivo.vn` / `www.nivo.vn` does not point at the VPS yet, or ports 80/443 are blocked                                                                                                      |
| Webhooks answer 401                | the provider's webhook secret differs between the provider and the sealed value, or the VPS clock is off by more than 5 minutes (`timedatectl`)                                                  |
| Every client shares one rate limit | the proxy hop is not trusted: check that the api runs behind exactly one proxy (the edge)                                                                                                        |
| A job is `failed`                  | `./jobs.sh failed` or `select id, name, state, attempts, last_error from job_outbox where state = 'failed' order by finished_at desc limit 20;`                                                  |
| A document stays "Waiting"         | `./jobs.sh open`, or `select name, state, attempts, last_error from job_outbox where state in ('queued','running');`; `job_stats()` shows a large `oldestQueuedAgeSeconds` when nothing consumes |
| Jobs fail in bulk                  | `./jobs.sh failed`, then resend with `./jobs.sh retry <outbox id>` (see `be/docs/runbooks/jobs-operations.md`)                                                                                   |
