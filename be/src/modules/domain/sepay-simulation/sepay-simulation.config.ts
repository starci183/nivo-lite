import type { Type } from "@nestjs/common"
import type { EnvSource } from "@modules/platform/config"
import type { SepaySimulationRegistration, SimulationPoster } from "./sepay-simulation.options"

/** Reads the simulation settings from the environment; the key stays absent until the operator sets SEPAY_WEBHOOK_API_KEY. */
export const parseSepaySimulationConfig = (
    env: EnvSource,
    poster: Type<SimulationPoster>,
    print: (line: string) => void,
): SepaySimulationRegistration => ({
    apiKey: env.has("SEPAY_WEBHOOK_API_KEY") ? env.secret("SEPAY_WEBHOOK_API_KEY") : undefined,
    bankCode: env.optional("SEPAY_BANK_CODE") ?? "MBBank",
    bankAccount: env.optional("SEPAY_BANK_ACCOUNT") ?? "0000000000",
    url: env.optional("SEPAY_SIMULATE_URL") ?? "http://localhost:3000/api/sepay/webhook",
    poster,
    print,
})
