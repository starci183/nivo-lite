/** What revoke agent connection takes. */
export interface RevokeAgentConnectionRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The connection. */
    readonly connectionId: string
}
