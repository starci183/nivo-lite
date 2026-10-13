/** One block of a legal document. */
export interface LegalSection {
    readonly id: string
    readonly title: string
    readonly paragraphs: ReadonlyArray<string>
    readonly items: ReadonlyArray<string>
    readonly afterItems: ReadonlyArray<string>
    /** Renders the verbatim Google API Services User Data Policy sentence, its link and the reader's-language note. */
    readonly limitedUse: boolean
}

/** The two legal documents the public pages serve. */
export type LegalDocKey = "privacy" | "terms"

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The strings of a catalog array; anything else is ignored. */
const stringsOf = (value: unknown): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []

/** Reads the sections of a legal document out of the raw catalog value; entries without an id and a title are dropped. */
export const readLegalSections = (raw: unknown): ReadonlyArray<LegalSection> => {
    if (!Array.isArray(raw)) return []
    return raw.flatMap((entry): ReadonlyArray<LegalSection> => {
        if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.title !== "string") return []
        return [
            {
                id: entry.id,
                title: entry.title,
                paragraphs: stringsOf(entry.paragraphs),
                items: stringsOf(entry.items),
                afterItems: stringsOf(entry.afterItems),
                limitedUse: entry.limitedUse === true,
            },
        ]
    })
}
