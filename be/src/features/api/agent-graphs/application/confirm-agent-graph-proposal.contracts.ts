/** What confirmAgentGraphProposal takes. */
export interface ConfirmAgentGraphProposalRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The proposal. */
    readonly proposalId: string
}
