/** What the LessonMiningStatus operation takes. */
export interface LessonMiningStatusRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}
