import type { Type } from "@nestjs/common"
import type { ApprovalAgentOwners, ApprovalEvents } from "./approval-requests.port"

/** The owners of the ports the capability calls through; each one has a default. */
export interface ApprovalRequestsPorts {
    /** Names the owner of an agent (the agents capability); nobody, so the workspace owner, when the app root names none. */
    readonly agentOwners?: Type<ApprovalAgentOwners>
    /** Receives the settled and reminder events; the evidence log when the app root names none. */
    readonly events?: Type<ApprovalEvents>
}

/** What the approval-requests capability takes from the app root. */
export interface ApprovalRequestsOptions {
    /** The owners of its ports. */
    readonly ports: ApprovalRequestsPorts
}
