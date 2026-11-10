/** What rename workspace takes. */
export interface RenameWorkspaceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The new name. */
    readonly name: string
}
