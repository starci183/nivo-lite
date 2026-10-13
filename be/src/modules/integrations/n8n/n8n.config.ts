import type { EnvSource } from "@modules/platform/config"
import type { N8nOptions } from "./n8n.options"

const HOST_SEPARATOR = ","

/** Reads the n8n options: the signing secret has no default; the timeout and the host list are tunables. */
export const parseN8nConfig = (env: EnvSource): N8nOptions => ({
    signingSecret: env.secret("N8N_SIGNING_SECRET"),
    webhookBase: env.has("N8N_WEBHOOK_BASE") ? env.url("N8N_WEBHOOK_BASE") : undefined,
    allowedHosts: (env.optional("N8N_ALLOWED_HOSTS") ?? "")
        .split(HOST_SEPARATOR)
        .map((host) => host.trim())
        .filter((host) => host.length > 0),
    timeoutMs: env.duration("N8N_EMIT_TIMEOUT", 10_000),
})
