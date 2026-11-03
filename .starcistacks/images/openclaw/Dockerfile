# The OpenClaw gateway of NIVO, one image for dev and production (PROJECT-STACKS-11, R374): the harness OpenClaw runtime layer (the
# source-built StarCi fork plus the generic wrapper under /opt/starci/), pinned by digest, and NIVO's one plugin.
#   nivo-bridge/   the plugin that gives an agent its one tool, nivo_call; the runtime init loads and enables every plugin folder of
#                  /opt/starci/plugins. OpenClaw refuses a world-writable plugin path, so it is owned by root and read-only to the gateway user.
# The services set STARCI_SECRETS (the secrets the wrapper exports besides the gateway token) and OPENCLAW_PROVIDER (the provider name the
# agents' model ids use, nivo-ai).
FROM ghcr.io/starci183/openclaw-runtime:2026.10.10-beta.5-starci.2@sha256:4257c488955dd17f403e18e5edd1d2253b4b6982ef0e3f235e3e3381b39953af
COPY --chown=root:root --chmod=0555 nivo-bridge/ /opt/starci/plugins/nivo-bridge/
