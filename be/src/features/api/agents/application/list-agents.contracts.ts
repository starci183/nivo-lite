/** What list agents takes. */
export interface ListAgentsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Only the agents of this module, or every module when absent. */
    readonly module?: string
}
