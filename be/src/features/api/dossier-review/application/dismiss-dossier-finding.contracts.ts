import type { Locale } from "@modules/platform/i18n"

/** What the DismissDossierFinding operation takes. */
export interface DismissDossierFindingRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The locale rule findings are worded in. */
    readonly locale: Locale
    /** The finding. */
    readonly findingId: string
    /** Why it is dismissed. */
    readonly reason: string
}
