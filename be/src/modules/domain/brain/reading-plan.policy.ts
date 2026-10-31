import { chunkPassages, passageTextHashOf } from "@modules/domain/knowledge-chunks"
import type { ReadingPlan } from "./brain.contracts"
import { windowsOf } from "./extraction.policy"

/**
 * What a reading of a document must do, given the hashes of the passages the last finished reading covered: only the changed passages
 * are read, and the unchanged ones are the text a fact may rest on to stay. With nothing in common the document is read whole, as a
 * first reading or a reading from before hashes is.
 */
export const readingPlanOf = (content: string, read: ReadonlyArray<string>): ReadingPlan => {
    const known = new Set(read)
    const passages = chunkPassages(content).map((text) => ({ text, hash: passageTextHashOf(text) }))
    const unchanged = passages.filter((passage) => known.has(passage.hash))
    const changed = passages.filter((passage) => !known.has(passage.hash))
    const partial = unchanged.length > 0
    return {
        partial,
        hashes: passages.map((passage) => passage.hash),
        unchangedText: unchanged.map((passage) => passage.text).join(" "),
        windows: windowsOf(partial ? changed.map((passage) => passage.text).join("\n\n") : content),
    }
}
