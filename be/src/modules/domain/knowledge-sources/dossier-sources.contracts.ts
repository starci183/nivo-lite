/** A document as the dossier review reads it: what files it under a dossier and how fresh it is, never its text. */
export interface DossierSource {
    /** The source id. */
    readonly id: string
    /** The title. */
    readonly title: string
    /** The topic label: the category of the dossier it files under. */
    readonly topic: string | null
    /** The tags. */
    readonly tags: ReadonlyArray<string>
    /** Where it came from: a folder, a ZIP, the Google Picker. */
    readonly origin: string | null
    /** text, faq, file or url. */
    readonly kind: string
    /** Where it stands. */
    readonly status: string
    /** How many passages are stored. */
    readonly chunkCount: number
    /** Its raw size in bytes. */
    readonly sizeBytes: number
    /** The last change, ISO 8601. */
    readonly updatedAt: string
    /** When it was added, ISO 8601. */
    readonly createdAt: string
}

/** A document the review reads, or null when there is none. */
export type MaybeDossierSource = DossierSource | null

/** The most documents one read of the dossier review answers. */
export const DOSSIER_SOURCES_MAX = 2000
