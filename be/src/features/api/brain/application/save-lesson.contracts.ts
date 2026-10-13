/** What save lesson takes. */
export interface SaveLessonRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent it is for; omitted = every agent. */
    readonly module?: string
    /** The title. */
    readonly title: string
    /** What to do. */
    readonly body: string
    /** When it applies. */
    readonly appliesWhen?: string
}
