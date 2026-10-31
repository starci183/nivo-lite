/** The text of one public document, as an agent quotes it. */
export interface PublicSourceText {
    /** Document title. */
    readonly title: string
    /** Optional topic. */
    readonly topic: string | null
    /** The document body. */
    readonly content: string
}

/** One public document as a picker lists it: who it is and a short preview. */
export interface PublicSourceExcerpt {
    /** Source identity. */
    readonly id: string
    /** Title. */
    readonly title: string
    /** Topic. */
    readonly topic: string | null
    /** The first characters of the text, with runs of white space folded into one space. */
    readonly excerpt: string
}

/** One public document that changed, as a change feed lists it. */
export interface ChangedPublicSource extends PublicSourceExcerpt {
    /** When it changed, as an ISO instant in UTC with microseconds. */
    readonly changedAt: string
}

/** One source of an origin as a status read lists it: where it stands and how big it is, never its text. */
export interface OriginSource {
    /** Source identity. */
    readonly id: string
    /** Title. */
    readonly title: string
    /** Where it stands. */
    readonly status: string
    /** public or internal. */
    readonly visibility: string
    /** The raw bytes it holds. */
    readonly sizeBytes: number
    /** Last change, ISO 8601. */
    readonly updatedAt: string
}
