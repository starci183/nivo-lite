# The VPS stack

One Ubuntu VPS runs **one Docker Swarm stack, `nivo`** (a single-manager swarm: it gives orchestration, rolling updates and rollback, not manager failover). The stack source is `.starcistacks/production/infra/swarm/stack.yaml`; the environment runbook with the seven commands is `.starcistacks/production/README.md`; the cutover from the previous Compose model is `be/docs/runbooks/cutover.md`.

| Service    | What                                                                                                        | Published port                             | Networks                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `ingress`  | Traefik: owns 80/443, Let's Encrypt certificates for `nivo.vn`, `www.nivo.vn`, `app.nivo.vn`, `api.nivo.vn` | **80, 443 (host mode)**, nothing else does | `edge`                         |
| `web`      | the Next.js console on `app.nivo.vn` (alias `nivo-web:3000`)                                                | none                                       | `edge`                         |
| `landing`  | the Next.js landing on `nivo.vn` and `www.nivo.vn` (alias `nivo-landing:3000`)                              | none                                       | `edge`                         |
| `api`      | the Nest api (alias `nivo-api:8787`): GraphQL, webhooks, workers, schedulers, the job alert monitor         | none                                       | `edge`, `agents`, `automation` |
| `openclaw` | the agent gateway (loopback inside the task, relay on `18790`)                                              | none                                       | `agents`                       |
| `n8n`      | n8n (private; operator tunnel only)                                                                         | none                                       | `automation`                   |

`namnivo-web` (the container of `nguyentuannam.org`, its own repository) shares the ingress by joining the attachable overlay network `nivo-edge-swarm`. The stack uses the volumes of the former Compose projects (`nivo-engine_openclaw-data`, `nivo-engine_video-cache`, `nivo-engine_n8n-data`, `nivo-edge_acme`) as external volumes, so no data moves and the Compose model can start again on them.

## 0. What you provide

| Need                   | Notes                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ubuntu 24.04 LTS amd64 | 22.04 LTS amd64 is a candidate; arm64 is not certified. At least 2 vCPU, 4 GB RAM, 40 GB SSD (OpenClaw + n8n + api). 8 GB when many agents run in parallel. Public IPv4. A single-node test never certifies manager failover.                                                                                |
| Domain                 | A records for `nivo.vn`, `www.nivo.vn`, `app.nivo.vn` and `api.nivo.vn` point at the VPS; verify before the first run, so the ingress can obtain certificates (the zone is at Tino; `be/docs/runbooks/dns-rollback.md`). Owner action, with a receipt (`nslookup`).                                          |
| SSH access             | A non-root key-login user in the `docker` group. The CI deploy key is authorised by the `.github/workflows/authorize-deploy-key.yml` workflow; the host key is pinned (`VPS_KNOWN_HOSTS`), first contact is owner-verified; changed host keys, passwords in argv and disabled host-key checking are refused. |
| Docker Engine          | From Docker's signed Ubuntu apt repository (https://docs.docker.com/engine/install/ubuntu/).                                                                                                                                                                                                                 |
| Database and sign-in   | `AUTH_JWT_PRIVATE_KEY`, `AUTH_JWT_PUBLIC_KEY` and the `PRIMARY_DB_URL` of the least-privilege role `app_be` (the platform migration is applied), all sealed.                                                                                                                                                 |
| Registry               | GHCR: the Deploy stack workflow pushes `ghcr.io/<owner>/nivo-lite-api`, `nivo-lite-web` and `nivo-lite-landing` (private) with the workflow's own token and deploys them by digest.                                                                                                                          |
| OpenClaw               | The public image `ghcr.io/openclaw/openclaw`, pinned by digest in `.starcistacks/production/infra/swarm/stack.yaml`. Change the tag and digest together, after testing.                                                                                                                                      |
| Model key              | The provider key the OpenClaw agents use (OpenRouter, Anthropic or OpenAI), sealed.                                                                                                                                                                                                                          |
| Generated secrets      | `OPENCLAW_GATEWAY_TOKEN`, the n8n encryption key (`openssl rand -hex 32`), sealed in the `stack` member of `.starcistacks/production/secrets/`.                                                                                                                                                              |

## 1. Ports and firewall

| Port                     | Listener  | Public?                                                                           |
| ------------------------ | --------- | --------------------------------------------------------------------------------- |
| 22/tcp                   | sshd      | Yes (SSH only)                                                                    |
| 80/tcp, 443/tcp          | `ingress` | Yes (80 is for Let's Encrypt and the redirect to HTTPS)                           |
| 2377/tcp, 7946, 4789/udp | Swarm     | **No** on a single node (leave closed; open only between nodes when one is added) |

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

**Important:** Docker publishes ports with its own iptables rules and **bypasses UFW**. Safety therefore comes from the stack: only `ingress` has a `ports:` entry, and the services talk over overlay networks. After a deploy, check from another machine: `nmap -Pn <ip>` must show only 22, 80 and 443. Overlay traffic is not assumed encrypted; on one node it never leaves the host, so decide on encrypted overlay networks (and test them) before adding a node.

Harden SSH (`/etc/ssh/sshd_config`): `PermitRootLogin no`, `PasswordAuthentication no`; consider `fail2ban`.

## 2. Prepare the host (once)

1. Install Docker Engine from the signed apt repository, `sudo usermod -aG docker $USER`, sign in again.
2. Release records: `sudo install -d -o $USER -m 750 /srv/nivo /srv/nivo/releases`.
3. **Owner approval: `docker swarm init`.** Creating a swarm is an effect with its own custody and recovery, so it is never part of a deploy. After the owner says yes: `starci app stack prepare --env production --init-swarm --owner-approved --execute` (on a host with several addresses, run `docker swarm init --advertise-addr <ip>` by hand instead). An active swarm is never re-initialized. Then back up the orchestration state: `starci app stack backup --env production --swarm-state --execute` (`/var/lib/docker/swarm` holds the keys; it is not a database backup) and decide whether to enable autolock (`docker swarm update --autolock=true`; keep the unlock key in the owner's protected store).
4. `starci app stack prepare --env production --execute` creates the four external volumes a fresh host lacks and checks the platform, capacity, Swarm state and manager identity. `starci app stack doctor --env production` repeats the checks and lists the stack, secrets and configs.

## 3. Configuration and secrets of the stack

Nothing secret is kept as an env file on the VPS or in GitHub. The sealed files `.starcistacks/production/secrets/{api,auth,stack}.enc` are decrypted **in memory on the runner** with the age identity (a protected GitHub environment secret) and each key is piped into `docker secret create nivo-<key>-v<keyed hash> -` on the manager over the pinned ssh session (`starci app stack deploy`). The stack keeps `{external: true, name: <runtimeName>}`; the services read `/run/secrets/<KEY>` through `<KEY>_FILE`. Swarm secrets are encrypted in transit and in Raft; protect manager access, backups and (when enabled) the autolock key.

- A release also creates versioned **config objects** for the ingress routes and the OpenClaw wrapper files (`nivo-<name>-c<content digest>`).
- The non-secret api configuration is `.starcistacks/production/infra/swarm/api-public.conf`; the names the api reads are in `api.env.example`; the OpenClaw model, the n8n allowed hosts and the job alert limits come from the `stack` member and are part of the non-secret configuration digest of the release.
- At cutover, set the Supabase Authentication Site URL to `https://app.nivo.vn`; allow Redirect URLs `https://app.nivo.vn/**`, `https://nivo.vn/**`, `https://www.nivo.vn/**`, `http://localhost:3000/**` and `http://127.0.0.1:3000/**`. Keep the old hosts for links sent before cutover.
- Losing the n8n encryption key means entering every credential in n8n again: it lives only in the sealed `stack` file, which is backed up with the age identity (the owner's StarCi runtime secret file).
- To bootstrap or rotate by hand: change the sealed value (`starci app secret set production <slug> ...`), commit, run **Deploy stack**. A changed value is a new secret name, the grant is updated, convergence is observed, and only then are superseded names removed (`starci app stack prune --execute`); a name is never reused.

## 4. Deploy

Run the workflow **Deploy stack** (Actions > Deploy stack > Run workflow). It builds and pushes the api, web and landing images, renders the stack with their digests, creates the secrets and configs, stores the release record under `/srv/nivo/releases/<digest16>/`, pre-pulls the images, runs `docker stack deploy --prune --with-registry-auth`, observes convergence, verifies the application and only then moves the `current` pointer. A failed run deploys the previous accepted release again. A manual deploy without GitHub uses the canon verbs at the repository root (`starci app stack render`, then `starci app stack deploy --execute`, or `deploy --skip-public --execute` followed by `starci app stack accept --execute`), reaching the manager with `--ssh-cmd` or on the manager itself; `starci app stack converge` and `starci app stack verify` observe a running release.

## 5. After the first run

1. **n8n** is private. `docker run --rm --name nivo-tunnel-n8n --network nivo_automation -p 127.0.0.1:5678:5678 alpine/socat TCP-LISTEN:5678,fork,reuseaddr TCP:nivo-n8n:5678` on the VPS (a loopback-only socat container on the private `automation` network), then `ssh -L 5678:127.0.0.1:5678 <user>@<vps>` from your machine and browse `http://127.0.0.1:5678`; create the owner account at once (the first person in becomes the owner). Create a workflow with a Webhook node on the path `nivo-events` so it matches `N8N_WEBHOOK_BASE` (`http://n8n:5678/webhook/nivo-events`). To publish n8n later, add an `n8n.<domain>` A record at Tino, a router in `.starcistacks/production/infra/swarm/edge/routes.yml` and the matching n8n host and webhook URL values in `.starcistacks/production/infra/swarm/stack.yaml`.
2. **OpenClaw**: `docker run --rm --name nivo-tunnel-openclaw --network nivo_agents -p 127.0.0.1:18789:18790 alpine/socat TCP-LISTEN:18790,fork,reuseaddr TCP:nivo-openclaw:18790` on the VPS, then `ssh -L 18789:127.0.0.1:18789 ...` and open `http://127.0.0.1:18789` for the Control UI; configure the model provider and create the agents. The api uses the agent `ws-<first 8 characters of the workspace id>-chatbot` for each workspace (or turn on `OPENCLAW_MANAGE_AGENTS=true` after verifying the schema).
3. **Check**: `curl https://api.nivo.vn/healthz` and `/readyz`; check the landing at `https://nivo.vn/health/live` and `https://www.nivo.vn/health/live`, and the console at `https://app.nivo.vn/health/live`. Send a test message through a connected channel (the reply must not be `direct_fallback`).
4. `docker service logs nivo_nivo-api --since 10m` on the manager shows the jobs running. Queue design and operation: `be/docs/guides/jobs.md` and `be/docs/runbooks/jobs-operations.md`.

If the api stops, the apps fall back to their direct processors when no heartbeat arrives within 90 seconds, so customers do not wait.

### Why the api is not in OpenClaw's network namespace any more

The gateway honours the scopes a client declares only for a loopback peer using the shared secret. The previous model put the api into the OpenClaw container's network namespace (`network_mode: service:openclaw`) and needed a host watchdog to recreate the api whenever OpenClaw restarted. On Swarm the api connects to `ws://openclaw:18790` (service DNS on the private `agents` overlay network). The OpenClaw entrypoint wrapper runs a small TCP relay inside the OpenClaw task that forwards to the loopback-only gateway, so the gateway sees a loopback peer; the token is still required. Restarting OpenClaw needs nothing else restarted (the api reconnects), so the coupling and the watchdog are gone. If a future OpenClaw version stops honouring scopes through the relay, the answer is device pairing for the api, not a return to the shared namespace.

## 6. Backup

State lives in the volumes: `nivo-engine_n8n-data` (n8n's SQLite database `database.sqlite` and its settings), `nivo-engine_openclaw-data` (configuration, agents, sessions), `nivo-edge_acme` (certificates, re-issued if lost) and `nivo-engine_video-cache` (a cache, disposable). The job queues (pgmq, the outbox and the claims) are in Supabase and covered by its backups. The api keeps no local state.

```bash
starci app stack backup --env production --execute [--swarm-state]   # age-encrypted tar of the declared volumes (n8n SQLite, OpenClaw), no plaintext file
```

There is no host crontab: run it by hand, from an external scheduler, or as a swarm job triggered by a declared scheduler component if the owner wants it automatic. Every backup is encrypted with `age` to the project recipient (the public key of `.sops.yaml`) while it is produced: the data flows from `tar` straight through `age` into `*.age` files, so no plaintext archive is ever written on the VPS, and a failed run leaves no file. Install `age` once (`sudo apt install age`). The private identity (the age key in the owner's StarCi runtime secret file) is never on the VPS, so only the owner can open a backup.

The same VPS is not an independent backup: **copy the backup folder elsewhere** (object storage or another machine). The age identity is the only other thing to keep safe: every secret is rebuilt from the sealed files. Restore: bring up a new stack, `docker service scale nivo_n8n=0`, decrypt on the owner's machine (`age -d -i <identity file> n8n-data-<stamp>.tgz.age | tar xzf - -C <volume mount>`) and unpack the archives into the matching volumes (the n8n archive restores `database.sqlite`), scale back to 1. **Try a restore on a test machine before you trust a backup.**

## 7. Update and roll back

- Update the api, web or landing: run **Deploy stack** again. The api receives SIGTERM, waits up to 45 seconds for running jobs and hands the rest back to the queue; a start-first update keeps the old task serving until the new one is healthy.
- Change the OpenClaw or n8n image: edit the pinned reference and digest in `.starcistacks/production/infra/swarm/stack.yaml` (review the diff, test first) and run **Deploy stack**. n8n migrates its database on start: **back up first**; a migrated database cannot go back.
- Roll back: **Roll back stack** redeploys the previous accepted release (or one you name) from its stored bytes; secret versions of the current and the previous release are always kept. It cannot undo a data effect: SQL migrations only move forward (write a new migration instead of editing an applied one), and a data restore is a separate action with an explicit loss window.
- Operator tools: `starci app stack doctor|converge|verify|backup|jobs|task`, plus plain `docker stack services nivo` and `docker service logs nivo_<service>` (service names: nivo-api, nivo-web-app, nivo-landing, nivo-openclaw, nivo-n8n) on the manager.

## 8. Quick troubleshooting

| Symptom                              | Check                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The api does not answer              | `docker stack services nivo`; `docker service logs nivo_nivo-api`; are `PRIMARY_DB_URL` and `SUPABASE_*` sealed in the `api` member of `.starcistacks/production/secrets/` (a missing key stops the boot with its name); `/readyz` answering 503 means the database is not reachable |
| A deploy rolled back                 | `docker service ps --no-trunc nivo_<service>` shows the task error; `starci app stack converge` prints it too                                                                                                                                                                        |
| Every turn is a `direct_fallback`    | `docker service logs nivo_nivo-api` for `OpenClaw failed (...)`: wrong token (a not-paired error), missing scope (`missingScope`: the relay is not in use, check the gateway URL `ws://openclaw:18790` and `docker service logs nivo_openclaw`), the agent does not exist, timeout   |
| The ingress cannot get a certificate | DNS of `nivo.vn` / `www.nivo.vn` / `app.nivo.vn` / `api.nivo.vn` does not point at the VPS yet, or ports 80/443 are blocked; the first request triggers the issuance                                                                                                                 |
| `nguyentuannam.org` answers 502      | `namnivo-web` is not on the network `nivo-edge-swarm` with the alias `namnivo-web` (`be/docs/runbooks/cutover.md`, step 6)                                                                                                                                                           |
| Webhooks answer 401                  | the provider's webhook secret differs between the provider and the sealed value, or the VPS clock is off by more than 5 minutes (`timedatectl`)                                                                                                                                      |
| Every client shares one rate limit   | the proxy hop is not trusted or the ingress ports are not in host mode: the api trusts exactly one proxy (the ingress) and needs the real client address                                                                                                                             |
| A job is `failed`                    | `starci app stack jobs failed --env production` or `select id, name, state, attempts, last_error from job_outbox where state = 'failed' order by finished_at desc limit 20;`                                                                                                         |
| A document stays "Waiting"           | `starci app stack jobs open --env production`; `job_stats()` shows a large `oldestQueuedAgeSeconds` when nothing consumes; the api writes a `job-ops.alert.jobs-stale` event and an `app_errors` row                                                                                 |
| Jobs fail in bulk                    | `starci app stack jobs failed --env production`, then resend with `starci app stack jobs retry <outbox id> --execute` (see `be/docs/runbooks/jobs-operations.md`)                                                                                                                    |
