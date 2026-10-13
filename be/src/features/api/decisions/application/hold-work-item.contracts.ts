import type { Locale } from "@modules/platform/i18n"

/** What holding a waiting work item takes. */
export interface HoldWorkItemRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The work item. */
    readonly workItemId: string
    /** Why there is not enough basis yet. */
    readonly note: string
    /** The language of the evidence line. */
    readonly locale: Locale
}
