import type { Type } from "@nestjs/common"
import type { ApprovalAgentOwners, ApprovalEvents } from "./approval-requests.port"

/** The owners of the ports the capability calls through; the app root names both. */
export interface ApprovalRequestsPorts {
    /** Names the owner of an agent (the agents capability). */
    readonly agentOwners: Type<ApprovalAgentOwners>
    /** Follows the settled requests (the work threads); the evidence log is written before it, whoever it is. */
    readonly events: Type<ApprovalEvents>
}

/** What the approval-requests capability takes from the app root. */
export interface ApprovalRequestsOptions {
    /** The owners of its ports. */
    readonly ports: ApprovalRequestsPorts
}
