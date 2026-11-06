/** What reading the authority takes. */
export interface ReadAuthorityRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
