/** What listing responsibilities takes. */
export interface ListResponsibilitiesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
