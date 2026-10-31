import type { Locale } from "@modules/platform/i18n"

/** What the ConfirmDossierFinding operation takes. */
export interface ConfirmDossierFindingRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The locale rule findings are worded in. */
    readonly locale: Locale
    /** The finding. */
    readonly findingId: string
    /** Why, or null. */
    readonly note: string | null
}
