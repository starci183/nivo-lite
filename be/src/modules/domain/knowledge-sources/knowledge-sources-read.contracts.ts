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

/** Where one internal document stands for a public document drafted from it: its title and the hash of the text its passages were made from. */
export interface SourceState {
    /** Source identity. */
    readonly id: string
    /** Title. */
    readonly title: string
    /** public or internal. */
    readonly visibility: string
    /** Where it stands. */
    readonly status: string
    /** The SHA-256 of the text whose passages are complete; null while the text is being read. */
    readonly contentHash: string | null
}

/** One document with its text and the lane it is kept for, as a tool that serves a view reads it. */
export interface SourceDocument extends SourceState {
    /** The module it is kept for, or null for every module. */
    readonly module: string | null
    /** The agent instance it is kept for, or null for every instance. */
    readonly installationId: string | null
    /** The topic. */
    readonly topic: string | null
    /** Its text. */
    readonly content: string
}

/** A document with its text and lane, or null when the workspace has no such document. */
export type MaybeSourceDocument = SourceDocument | null

/** A ready document kept for one agent instance alone, with the text a copy of it needs. */
export interface InstanceDocument {
    /** The source id. */
    readonly id: string
    /** text, faq, file or url. */
    readonly kind: string
    /** The title. */
    readonly title: string
    /** The text (the address of a link source). */
    readonly content: string
    /** The topic, or null. */
    readonly topic: string | null
    /** The tags. */
    readonly tags: ReadonlyArray<string>
    /** public or internal. */
    readonly visibility: string
}
