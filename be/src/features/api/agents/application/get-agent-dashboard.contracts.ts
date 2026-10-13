/** What get agent dashboard takes. */
export interface GetAgentDashboardRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The module whose dashboard it is. */
    readonly module: string
    /** The instance whose dashboard it is; the first of the module when absent. */
    readonly installationId?: string
}
