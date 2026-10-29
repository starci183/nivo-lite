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
