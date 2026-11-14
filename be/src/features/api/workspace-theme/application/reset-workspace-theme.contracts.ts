/** What returning the active workspace to the NIVO default theme takes. */
export interface ResetWorkspaceThemeRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they own or manage it. */
    readonly workspaceId: string
}
