/** What renaming an instance takes. */
export interface RenameInstallationRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
    /** The new label. */
    readonly name: string
}
