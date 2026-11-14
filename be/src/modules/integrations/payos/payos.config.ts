import type { EnvSource } from "@modules/platform/config"
import type { PayosOptions } from "./payos.options"

/** The origin of payOS's payment API (https://payos.vn/docs/api/ : `POST https://api-merchant.payos.vn/v2/payment-requests`); a fake of a test world overrides it. */
const DEFAULT_API_BASE = "https://api-merchant.payos.vn"

/** Reads the payOS options: the three keys are per connection and stored sealed, so only tunables live in the environment. */
export const parsePayosConfig = (env: EnvSource): PayosOptions => ({
    apiBase: (env.optional("PAYOS_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("PAYOS_API_TIMEOUT", 15_000),
})
