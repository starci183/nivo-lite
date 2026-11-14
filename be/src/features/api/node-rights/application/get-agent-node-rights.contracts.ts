/** What agentNodeRights takes. */
export interface GetAgentNodeRightsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The agent whose rights page is read. */
    readonly agentId: string
}
