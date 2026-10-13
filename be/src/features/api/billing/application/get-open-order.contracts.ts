/** What reading the open plan order of a workspace takes. */
export interface GetOpenOrderRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
