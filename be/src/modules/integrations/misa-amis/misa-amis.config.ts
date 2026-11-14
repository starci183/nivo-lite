import type { EnvSource } from "@modules/platform/config"
import type { MisaAmisOptions } from "./misa-amis.options"

/** Reads the MISA AMIS options: only tunables live in the environment. */
export const parseMisaAmisConfig = (env: EnvSource): MisaAmisOptions => ({
    timeoutMs: env.duration("MISA_AMIS_API_TIMEOUT", 20_000),
})
