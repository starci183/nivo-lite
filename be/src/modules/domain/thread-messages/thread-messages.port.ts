import type {
    ApprovalDecision,
    ApprovalDecisionResult,
    OpenApproval,
    OpenedApproval,
} from "./thread-messages.contracts"

/** The one door to the approval capability: open a request and decide it. The app root binds it to ApprovalRequestsService. */
export interface ApprovalGate {
    /** Opens a request for the action and answers the people to tag, the ones left out, the policy and the deadline. */
    open(request: OpenApproval): Promise<OpenedApproval>
    /** Records a member's verdict; the gate proves the member may decide it and applies the policy. */
    decide(decision: ApprovalDecision): Promise<ApprovalDecisionResult>
}

/** The one door to the agents capability for who may tag and assign whom. The app root binds it to AgentsService. */
export interface AgentRules {
    /** Whether the agent may tag the other agent. */
    canTag(agentId: string, targetAgentId: string): Promise<boolean>
    /** Whether the member may give the agent work. */
    canAssign(memberId: string, agentId: string): Promise<boolean>
}
