/** What the dashboard read takes. */
export interface GetDashboardRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
