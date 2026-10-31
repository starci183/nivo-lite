/** What switch work on or off for every agent of the workspace takes. */
export interface SetWorkspaceAgentWorkRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** True to switch work on. */
    readonly enabled: boolean
}
