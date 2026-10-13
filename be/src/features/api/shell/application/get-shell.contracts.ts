/** What get shell takes. */
export interface GetShellRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** Start of the Founding window, ISO 8601. */
    readonly foundingFrom: string
    /** End of the Founding window, ISO 8601. */
    readonly foundingTo: string
}
