/** What set agent status takes. */
export interface SetAgentStatusRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** True to resume the agent, false to pause it. */
    readonly active: boolean
}
