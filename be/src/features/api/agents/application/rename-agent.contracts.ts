/** What rename agent takes. */
export interface RenameAgentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The new display name. */
    readonly name: string
}
