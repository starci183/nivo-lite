import type { EnvSource } from "@modules/platform/config"
import type { CreatomateOptions } from "./creatomate.options"

/** The API base of the Creatomate reference (https://creatomate.com/llms/api.md, "Base URL"). */
const DEFAULT_API_BASE = "https://api.creatomate.com"

/** Reads the Creatomate options: only tunables live in the environment. */
export const parseCreatomateConfig = (env: EnvSource): CreatomateOptions => ({
    apiBase: (env.optional("CREATOMATE_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("CREATOMATE_API_TIMEOUT", 30_000),
})
