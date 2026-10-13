/** What mine lessons takes. */
export interface MineLessonsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The agent whose corrections are studied. */
    readonly module: string
}
