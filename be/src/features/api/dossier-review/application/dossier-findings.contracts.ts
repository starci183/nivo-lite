import type { Locale } from "@modules/platform/i18n"

/** What the DossierFindings operation takes. */
export interface DossierFindingsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The locale rule findings are worded in. */
    readonly locale: Locale
    /** The page size, or null for the default. */
    readonly first: number | null
    /** The cursor of the page before, or null for the first page. */
    readonly after: string | null
    /** Only the findings of this dossier, or null. */
    readonly dossierId: string | null
    /** Only these statuses, or null. */
    readonly statuses: ReadonlyArray<string> | null
    /** Only these severities, or null. */
    readonly severities: ReadonlyArray<string> | null
    /** Only the findings assigned to this member, or null. */
    readonly assigneeId: string | null
    /** True keeps only the findings nobody owns. */
    readonly unassigned: boolean | null
    /** True keeps only the findings with a draft waiting for approval. */
    readonly draftsAwaiting: boolean | null
}
