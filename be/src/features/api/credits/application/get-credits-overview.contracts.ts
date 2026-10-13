/** What reading the credits overview takes. */
export interface GetCreditsOverviewRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
