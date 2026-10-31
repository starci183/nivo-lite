import type { Locale } from "@modules/platform/i18n"

/** What the ReopenDossierFinding operation takes. */
export interface ReopenDossierFindingRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The locale rule findings are worded in. */
    readonly locale: Locale
    /** The finding. */
    readonly findingId: string
}
