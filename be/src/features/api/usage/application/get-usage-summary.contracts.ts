/** What reading the usage summary takes. */
export interface GetUsageSummaryRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
}
