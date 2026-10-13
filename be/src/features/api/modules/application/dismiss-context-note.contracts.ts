/** What dismissing a context note takes. */
export interface DismissContextNoteRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The note. */
    readonly noteId: string
}
