/** What decide lesson takes. */
export interface DecideLessonRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The lesson. */
    readonly id: string
    /** active or rejected for a proposal; retired for a lesson in force. */
    readonly action: "active" | "rejected" | "retired"
}
