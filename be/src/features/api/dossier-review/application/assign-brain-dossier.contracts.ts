/** What the AssignBrainDossier operation takes. */
export interface AssignBrainDossierRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The dossier. */
    readonly dossierId: string
    /** The membership id of the owner, or null to leave it with nobody. */
    readonly assigneeId: string | null
    /** The due date as YYYY-MM-DD, or null. */
    readonly dueAt: string | null
}
