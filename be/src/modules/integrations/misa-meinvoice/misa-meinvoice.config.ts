import type { EnvSource } from "@modules/platform/config"
import type { MisaMeinvoiceOptions } from "./misa-meinvoice.options"

/** Reads the MISA meInvoice options: only tunables live in the environment. */
export const parseMisaMeinvoiceConfig = (env: EnvSource): MisaMeinvoiceOptions => ({
    timeoutMs: env.duration("MISA_MEINVOICE_API_TIMEOUT", 20_000),
})
