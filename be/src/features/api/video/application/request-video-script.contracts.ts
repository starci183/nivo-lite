/** The project in the selected workspace to script. */
export interface RequestVideoScriptRequest {
    /** Authenticated workspace selection. */
    readonly workspaceId: string
    /** Project the manager controls. */
    readonly projectId: string
}
