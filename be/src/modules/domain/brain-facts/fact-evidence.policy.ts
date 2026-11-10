import type { Evidence, FactRecord } from "./brain-facts.contracts"
import { foldedText } from "./fact-key.policy"

/** How much of a quote is compared, as the reading compares a quote with its window. */
const QUOTE_CHARS = 60

/** The shortest folded text that proves anything. */
const MIN_CHARS = 3

/** What of a changed document still stands: its unchanged passages, by hash and as one folded text. */
export interface UnchangedPassages {
    /** The hashes of the passages that did not change. */
    readonly hashes: ReadonlyArray<string>
    /** Their text, folded, for evidence read before chunk hashes. */
    readonly folded: string
}

/** Nothing of the document stands: it was deleted or every passage changed. */
export const NOTHING_STANDS: UnchangedPassages = { hashes: [], folded: "" }

/** Whether one piece of evidence of the document still stands: by its chunk hash, else (older evidence) by its quote or the value. */
const itemStands = (item: Evidence, value: string, unchanged: UnchangedPassages, hashes: ReadonlySet<string>): boolean => {
    if (item.chunkHash !== undefined) return hashes.has(item.chunkHash)
    const mark = foldedText(item.quote ?? value).slice(0, QUOTE_CHARS)
    return mark.length >= MIN_CHARS && unchanged.folded.includes(mark)
}

/** What a change of one document does to the evidence of one fact. */
export interface EvidenceAfterChange {
    /** True when a piece of this document's evidence no longer stands: the fact is touched. */
    readonly touched: boolean
    /** The evidence the fact keeps. */
    readonly rest: ReadonlyArray<Evidence>
}

/**
 * The evidence of a fact after its document changed: a piece read from a passage that is still there stays; a piece from a passage
 * that changed or went is dropped. A fact none of whose pieces changed is not touched at all (the partial update: a changed chunk
 * moves only the facts born from it).
 */
export const evidenceAfterChange = (
    fact: Pick<FactRecord, "evidence" | "value">,
    sourceId: string,
    unchanged: UnchangedPassages,
): EvidenceAfterChange => {
    const hashes = new Set(unchanged.hashes)
    const rest = fact.evidence.filter(
        (item) => !(item.kind === "document" && item.ref === sourceId) || itemStands(item, fact.value, unchanged, hashes),
    )
    return { touched: rest.length !== fact.evidence.length, rest }
}

/** Whether a fact still rests on a folded text of this document: the quote it was read with, or its value when it has no quote. */
export const factStandsIn = (fact: FactRecord, sourceId: string, folded: string): boolean =>
    !evidenceAfterChange(fact, sourceId, { hashes: [], folded }).touched &&
    fact.evidence.some((item) => item.kind === "document" && item.ref === sourceId)
