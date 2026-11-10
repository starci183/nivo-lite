/** Hands one customer to an agent in the active workspace. */
export interface AssignInboxLeadRequest {
    /** The workspace selected by the transport. */
    readonly workspaceId: string
    /** The lead. */
    readonly leadId: string
    /** The agent, or null to take the customer back. */
    readonly agentId: string | null
}
