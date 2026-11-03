# INTERIM (2026-11-03). Target form: FROM the harness OpenClaw runtime image (D:/.claude images/openclaw, which takes over the generic
# wrapper: entrypoint.sh, openclaw-init.mjs, openclaw-relay.mjs and their modes) plus one COPY of nivo-bridge/ into its plugin directory.
# Until that image exists this file layers the current wrapper on the upstream OpenClaw 2026.7.1 the stack already ran, pinned by digest.
# The StarCi fork (ghcr.io/starci183/openclaw:2026.10.10-beta.5-starci.1@sha256:0770c1da...) was tried and is not adoptable by a COPY
# alone: its doctor must migrate the 2026.7.1 state database (audit-events-v2), it refuses the implicit primary model and the legacy
# agents.defaults.models params openclaw-init.mjs writes (modelPolicy.allow), and its config write fails on the dev state folder
# (ENOENT on fstat after the atomic rename). That adaptation belongs to the harness runtime image.
#
# The OpenClaw gateway of NIVO, one image for dev and production; nothing is mounted into the container but the agent state and secrets.
#   entrypoint.sh       exports the granted /run/secrets values into the gateway process, writes openclaw.json, starts the relay
#   openclaw-init.mjs   merges the gateway settings (loopback bind, token auth, the nivo-ai provider, the nivo-bridge plugin) into openclaw.json
#   openclaw-relay.mjs  the TCP relay on 18790 that lets the api reach the loopback-only gateway as a loopback peer
#   nivo-bridge/        the plugin that gives an agent its one tool, nivo_call; OpenClaw refuses a world-writable plugin path, so it is
#                       owned by root and read-only to the gateway user
FROM ghcr.io/openclaw/openclaw:2026.7.1@sha256:6a31d44b2944e7adcd2b582bf6fb463111264ebca97a0201795b799135bd102c
COPY --chown=root:root --chmod=0555 entrypoint.sh openclaw-init.mjs openclaw-relay.mjs /opt/nivo/
COPY --chown=root:root --chmod=0555 nivo-bridge/ /opt/nivo/nivo-bridge/
ENV OPENCLAW_RELAY_PORT=18790 \
    OPENCLAW_SKIP_CRON=1
EXPOSE 18790
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:18790/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
ENTRYPOINT ["tini", "-s", "--", "sh", "/opt/nivo/entrypoint.sh"]
