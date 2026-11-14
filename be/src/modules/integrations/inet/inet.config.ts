import type { EnvSource } from "@modules/platform/config"
import type { InetOptions } from "./inet.options"

/** The public gateway of iNET's API (https://developers.inet.vn/api-reference: "Base URL"); a fake of a test world overrides it. */
const DEFAULT_API_BASE = "https://developers.inet.vn/api/gateway/v1"

/** Reads the iNET options: the API key is per connection and stored sealed, so only tunables live in the environment. */
export const parseInetConfig = (env: EnvSource): InetOptions => ({
    apiBase: (env.optional("INET_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("INET_API_TIMEOUT", 15_000),
})
