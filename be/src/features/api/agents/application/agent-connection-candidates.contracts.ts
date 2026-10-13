/** What listing the connections an agent may be granted takes. */
export interface AgentConnectionCandidatesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
}
