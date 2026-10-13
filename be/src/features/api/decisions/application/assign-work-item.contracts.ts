import type { Locale } from "@modules/platform/i18n"

/** What assigning a work item takes. */
export interface AssignWorkItemRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The work item. */
    readonly workItemId: string
    /** The staff member, or null to take the assignment back. Absent means the same as null. */
    readonly staffId?: string | null
    /** The language of the evidence line. */
    readonly locale: Locale
}
