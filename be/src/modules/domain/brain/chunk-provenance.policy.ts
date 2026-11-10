import { foldedText } from "@modules/domain/brain-facts"

/** How much of a quote is compared with a passage, as the withdrawal compares a quote with the unchanged text. */
const QUOTE_CHARS = 60

/** The shortest folded quote that names a passage. */
const MIN_CHARS = 3

/** One passage of a document: its text and the hash a fact born from it carries. */
export interface HashedPassage {
    /** The passage text. */
    readonly text: string
    /** `passageTextHashOf(text)`. */
    readonly hash: string
}

/** A passage folded once for the lookups of a whole reading. */
export interface FoldedPassage {
    /** The passage text, folded. */
    readonly folded: string
    /** The passage hash. */
    readonly hash: string
}

/** The passages of a reading, folded once. */
export const foldedPassagesOf = (passages: ReadonlyArray<HashedPassage>): ReadonlyArray<FoldedPassage> =>
    passages.map((passage) => ({ folded: foldedText(passage.text), hash: passage.hash }))

/**
 * The passage a fact was read from: the first passage that holds its quote (or its value when the model gave no quote). Null when no
 * passage holds it whole (a quote across two passages): the fact then rests on its text, as a fact read before chunk hashes does.
 */
export const chunkHashOf = (mark: string, passages: ReadonlyArray<FoldedPassage>): string | null => {
    const folded = foldedText(mark).slice(0, QUOTE_CHARS)
    if (folded.length < MIN_CHARS) return null
    return passages.find((passage) => passage.folded.includes(folded))?.hash ?? null
}
