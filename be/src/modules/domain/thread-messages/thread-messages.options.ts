import type { InjectionToken } from "@nestjs/common"

/** What the thread-messages capability needs from the app root. */
export interface ThreadMessagesOptions {
    /** Provider that opens and decides approval requests (the approval requests capability); absent while it is not bound, and asking for an approval is then refused. */
    readonly approvalGate?: InjectionToken
    /** Provider that tells who may tag and assign whom (the agents capability). */
    readonly agentRules: InjectionToken
}
