/** What declineAgentGraphProposal takes. */
export interface DeclineAgentGraphProposalRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The proposal. */
    readonly proposalId: string
}
