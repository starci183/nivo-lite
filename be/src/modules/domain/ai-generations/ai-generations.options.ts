import type { Type } from "@nestjs/common"
import type { UsageGate } from "./ai-generations.port"

/** The options of the ai-generations capability. */
export interface AiGenerationsOptions {
    /** The class that implements the usage port (billing lane). */
    readonly usage: Type<UsageGate>
    /** How often a caller looks at its generation row, ms. */
    readonly pollMs: number
}

/** The default polling interval: 400 ms. */
export const AI_GENERATIONS_POLL_MS = 400
