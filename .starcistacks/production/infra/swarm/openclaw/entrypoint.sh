#!/bin/sh
# Entrypoint wrapper of the OpenClaw gateway on Swarm (a config object mounted at /opt/nivo/entrypoint.sh).
#
# 1. The OpenClaw image has no `<NAME>_FILE` support, so the gateway token and the StarCi AI gateway virtual key (STARCI_AI_KEY) are exported from the Swarm secrets
#    under /run/secrets into THIS process tree only: no env file on the host, no value in the service specification.
# 1b. OPENCLAW_BRIDGE_SECRET signs the calls of the nivo-bridge plugin (see openclaw/nivo-bridge); without it the plugin registers no tool.
# 2. openclaw-init.mjs merges the gateway settings into openclaw.json (idempotent; other keys, agents and plugins are kept).
# 3. openclaw-relay.mjs listens on the overlay address and forwards to the loopback-only gateway. The gateway honours the scopes a client
#    declares ONLY for a loopback peer using the shared secret, so the api connects to nivo-openclaw:18790 (service DNS on the private `agents`
#    network) and the gateway sees the relay, a loopback peer. The token is still required; only the api and an operator tunnel are on that network.
set -eu

for name in OPENCLAW_GATEWAY_TOKEN OPENCLAW_BRIDGE_SECRET STARCI_AI_KEY; do
  file="/run/secrets/$name"
  if [ -r "$file" ]; then
    value="$(cat "$file")"
    export "$name=$value"
  fi
done
: "${OPENCLAW_GATEWAY_TOKEN:?the secret OPENCLAW_GATEWAY_TOKEN is not granted to this service}"

OPENCLAW_GATEWAY_TOKEN_FILE=/run/secrets/OPENCLAW_GATEWAY_TOKEN node /opt/nivo/openclaw-init.mjs
node /opt/nivo/openclaw-relay.mjs &
exec node openclaw.mjs gateway
