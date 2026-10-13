import type { ExtendedSubscription } from "@modules/domain/platform-admin"

/** What extendSubscription takes. */
export interface ExtendSubscriptionRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** Whole days to add, 1 to 366. */
    readonly days: number
}

/** What extendSubscription answers. */
export type ExtendSubscriptionResult = Readonly<ExtendedSubscription>
