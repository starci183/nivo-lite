/** What reading the theme of the active workspace takes. */
export interface ReadWorkspaceThemeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
