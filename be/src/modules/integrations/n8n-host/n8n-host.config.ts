import type { EnvSource } from "@modules/platform/config"
import type { N8nHostOptions } from "./n8n-host.options"

const DEFAULT_CONTAINER = "nivo-engine-n8n-1"

/** Reads where the n8n container runs from the environment. */
export const parseN8nHostConfig = (env: EnvSource): N8nHostOptions => ({
    host: env.optional("VPS_HOST"),
    user: env.optional("VPS_USER") ?? "nivo",
    sshKey: env.has("VPS_SSH_KEY") ? env.secret("VPS_SSH_KEY") : undefined,
    knownHosts: env.optional("VPS_KNOWN_HOSTS"),
    container: env.optional("N8N_CONTAINER") ?? DEFAULT_CONTAINER,
})
