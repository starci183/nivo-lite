/** What reading the channel choices of a role takes. */
export interface AgentChannelChoicesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The role (module key). */
    readonly moduleKey: string
}
