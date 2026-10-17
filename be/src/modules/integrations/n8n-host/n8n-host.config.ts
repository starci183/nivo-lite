import type { EnvSource } from "@modules/platform/config"
import type { N8nHostOptions } from "./n8n-host.options"

/** The running task of the Swarm service nivo_nivo-n8n: Swarm names the container per task, so the shell on the VPS resolves it when the command runs. */
const DEFAULT_CONTAINER =
    "$(docker ps -q --filter label=com.docker.swarm.service.name=nivo_nivo-n8n --filter status=running | head -n 1)"

/** Reads where the n8n container runs from the environment. */
export const parseN8nHostConfig = (env: EnvSource): N8nHostOptions => ({
    host: env.optional("VPS_HOST"),
    user: env.optional("VPS_USER") ?? "nivo",
    sshKey: env.has("VPS_SSH_KEY") ? env.secret("VPS_SSH_KEY") : undefined,
    knownHosts: env.optional("VPS_KNOWN_HOSTS"),
    container: env.optional("N8N_CONTAINER") ?? DEFAULT_CONTAINER,
})
