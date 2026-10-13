/** What the KeepCurrentBrainFact operation takes. */
export interface KeepCurrentBrainFactRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The normalised subject. */
    readonly subjectKey: string
    /** The normalised attribute. */
    readonly attribute: string
    /** The agent instance the key is scoped to; omitted = every instance. */
    readonly installationId?: string
}
