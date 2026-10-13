/** What listing the installed agents takes. */
export interface ListInstallationsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
