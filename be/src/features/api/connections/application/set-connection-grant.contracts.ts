/** What setConnectionGrant takes. */
export interface SetConnectionGrantRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** The agent. */
    readonly agentId: string
    /** True binds the agent to the connection, false removes the binding. */
    readonly bound: boolean
}
