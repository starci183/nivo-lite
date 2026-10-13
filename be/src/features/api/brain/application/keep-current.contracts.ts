/** What keep current takes. */
export interface KeepCurrentRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The normalised subject. */
    readonly subjectKey: string
    /** The normalised attribute. */
    readonly attribute: string
    /** The agent instance the key is scoped to; omitted = every instance. */
    readonly installationId?: string
}
