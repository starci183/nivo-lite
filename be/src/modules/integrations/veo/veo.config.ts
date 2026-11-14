import type { EnvSource } from "@modules/platform/config"
import type { VeoOptions } from "./veo.options"

/** The REST base of the Veo guide (https://aistudio.google.com/docs/veo, `BASE_URL`). */
const DEFAULT_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

/** Reads the Veo options: only tunables live in the environment. */
export const parseVeoConfig = (env: EnvSource): VeoOptions => ({
    apiBase: (env.optional("VEO_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("VEO_API_TIMEOUT", 30_000),
    mediaTimeoutMs: env.duration("VEO_MEDIA_TIMEOUT", 180_000),
})
