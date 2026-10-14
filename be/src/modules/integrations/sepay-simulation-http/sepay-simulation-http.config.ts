import type { SepaySimulationHttpOptions } from "./sepay-simulation-http.options"

/** Keeps the simulated delivery's fixed fifteen-second deadline. */
export const parseSepaySimulationHttpConfig = (): SepaySimulationHttpOptions => ({ timeoutMs: 15_000 })
