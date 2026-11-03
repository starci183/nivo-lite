import type { InjectionToken } from "@nestjs/common"

/** What the work-performers capability needs from the app root. */
export interface WorkPerformersOptions {
    /** The provider token of the prompt writer (a `PromptWriter`); the prompt library of the ai-tasks capability. */
    readonly writer: InjectionToken
    /** How long a customer's claim that they paid waits for the money before the owner is asked, in minutes; 30 when absent. */
    readonly claimTimeoutMinutes?: number | undefined
    /** How far back an open order is still looked at for a bank credit, in hours; 72 when absent. */
    readonly orderWindowHours?: number | undefined
}
