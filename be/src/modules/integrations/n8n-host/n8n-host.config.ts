import { homedir } from "node:os"
import { join } from "node:path"
import type { EnvSource } from "@modules/platform/config"
import type { N8nHostOptions } from "./n8n-host.options"

const HOME_MARK = "~"
const DEFAULT_CONTAINER = "nivo-engine-n8n-1"
const DEFAULT_ROOT = "resources"

/** Expands a leading `~` to the home directory. */
const expand = (path: string): string => (path.startsWith(HOME_MARK) ? join(homedir(), path.slice(1)) : path)

/** Reads where the n8n container runs from the environment. */
export const parseN8nHostConfig = (env: EnvSource): N8nHostOptions => ({
    host: env.optional("VPS_HOST"),
    user: env.optional("VPS_USER") ?? "nivo",
    keyPath: expand(env.optional("VPS_SSH_KEY") ?? "~/.nivo-lite/vps_ed25519"),
    knownHostsPath: env.has("VPS_KNOWN_HOSTS") ? expand(env.string("VPS_KNOWN_HOSTS")) : undefined,
    container: env.optional("N8N_CONTAINER") ?? DEFAULT_CONTAINER,
    root: env.optional("TEMPLATE_RESOURCES_DIR") ?? DEFAULT_ROOT,
})
