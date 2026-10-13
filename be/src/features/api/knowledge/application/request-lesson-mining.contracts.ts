/** What the RequestLessonMining operation takes. */
export interface RequestLessonMiningRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly module: string
}
