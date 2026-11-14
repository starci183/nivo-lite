import type { EnvSource } from "@modules/platform/config"
import type { TinoOptions } from "./tino.options"

/** The public origin of Tino's API (https://docs.tino.vn/openapi.json `servers`); a fake of a test world overrides it. */
const DEFAULT_API_BASE = "https://api.tino.vn"

/** Reads the Tino options: the API token is per connection and stored sealed, so only tunables live in the environment. */
export const parseTinoConfig = (env: EnvSource): TinoOptions => ({
    apiBase: (env.optional("TINO_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("TINO_API_TIMEOUT", 15_000),
})
