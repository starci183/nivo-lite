/** What the DecideBrainLesson operation takes. */
export interface DecideBrainLessonRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
    /** `active` or `rejected` for a proposal; `retired` for a lesson in force. */
    readonly action: "active" | "rejected" | "retired"
}
