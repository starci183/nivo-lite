/** What reading the settings of the active workspace takes. */
export interface ReadWorkspaceSettingsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
