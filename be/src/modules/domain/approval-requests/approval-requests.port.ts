import type { ApprovalResolved } from "./approval-requests.contracts"

/** The one door out of the capability: it tells the work chain a request was settled. The evidence log is written before it. */
export interface ApprovalEvents {
    /** Publishes `approval.resolved`. */
    resolved(event: ApprovalResolved): Promise<void>
}

/** Who answers for an agent: the member it was assigned to and the member who stands in for them. */
export interface AgentOwnerRef {
    /** The member the agent is assigned to; null when none was set. */
    readonly ownerMemberId: string | null
    /** The member who stands in for the owner; null when none was set. */
    readonly fallbackMemberId: string | null
}

/** The one door to the agents: a request that ran out of time goes to the owner of the agent that asked. The app root binds it to `AgentsService.ownerOf`. */
export interface ApprovalAgentOwners {
    /** The owner and the fallback of an agent. */
    ownerOf(agentId: string): Promise<AgentOwnerRef>
}
