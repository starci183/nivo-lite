import type { InjectionToken } from "@nestjs/common"

/** What the work-chains capability needs from the app root. */
export interface WorkChainsOptions {
    /** Provider that tells who answers for an agent (the agents capability). */
    readonly ownerDirectory: InjectionToken
}
