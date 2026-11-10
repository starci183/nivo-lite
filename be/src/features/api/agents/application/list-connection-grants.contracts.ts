/** What list connection agents takes. */
export interface ListConnectionGrantsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
