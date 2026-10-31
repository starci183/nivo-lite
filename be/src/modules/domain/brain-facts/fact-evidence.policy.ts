import type { FactRecord } from "./brain-facts.contracts"
import { foldedText } from "./fact-key.policy"

/** How much of a quote is compared, as the reading compares a quote with its window. */
const QUOTE_CHARS = 60

/** The shortest folded text that proves anything. */
const MIN_CHARS = 3

/** Whether a fact still rests on a folded text of this document: the quote it was read with, or its value when it has no quote. */
export const factStandsIn = (fact: FactRecord, sourceId: string, folded: string): boolean =>
    fact.evidence.some((item) => {
        if (item.kind !== "document" || item.ref !== sourceId) return false
        const mark = foldedText(item.quote ?? fact.value).slice(0, QUOTE_CHARS)
        return mark.length >= MIN_CHARS && folded.includes(mark)
    })
