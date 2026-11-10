/** What my work in hand takes. */
export interface MyWorkInHandRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
