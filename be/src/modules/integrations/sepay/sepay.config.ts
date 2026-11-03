import type { EnvSource } from "@modules/platform/config"
import type { SepayOptions } from "./sepay.options"

/** The public SePay origin; a fake of the test world overrides it with SEPAY_API_BASE. */
const DEFAULT_API_BASE = "https://my.sepay.vn"

/** Reads the SePay options: the API token is per connection and stored encrypted, so only tunables live in the environment. */
export const parseSepayConfig = (env: EnvSource): SepayOptions => ({
    apiBase: (env.optional("SEPAY_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("SEPAY_API_TIMEOUT", 15_000),
})
