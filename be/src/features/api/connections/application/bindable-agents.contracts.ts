/** What bindableAgents takes. */
export interface BindableAgentsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The provider a connection would be of. */
    readonly provider: string
}
