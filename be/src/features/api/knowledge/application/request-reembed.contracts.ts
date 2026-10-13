/** What request reembed takes. */
export interface RequestReembedRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
