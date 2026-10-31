import type { Locale } from "@modules/platform/i18n"

/** What the AssignDossierFinding operation takes. */
export interface AssignDossierFindingRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The locale rule findings are worded in. */
    readonly locale: Locale
    /** The finding. */
    readonly findingId: string
    /** The member, or null to leave it unassigned. */
    readonly assigneeId: string | null
    /** The due date as YYYY-MM-DD, or null. */
    readonly dueAt: string | null
}
