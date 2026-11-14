/** What getAgentAbilityProposal takes. */
export interface GetAgentAbilityProposalRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The module of the agent to create. */
    readonly moduleKey: string
}
