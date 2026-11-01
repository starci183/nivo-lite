import type { FactRecord } from "./brain-facts.contracts"

/** What the note of a fact applied together with others starts with; the rest is the id of the batch. */
const BULK_TAG = "bulk:"

/** The shortest verbatim quote that counts as the document saying it. */
const MIN_QUOTE_CHARS = 8

/** The start of the note every fact of one batch carries, so the batch is found again to be taken back. */
export const bulkTagOf = (batchId: string): string => `${BULK_TAG}${batchId}`

/** The note a fact applied together with others keeps: the batch it belongs to, then the words a reader sees. */
export const bulkNoteOf = (batchId: string, title: string): string =>
    `${bulkTagOf(batchId)} - Applied together with the other checked facts of "${title.slice(0, 80)}"`

/** The decision note of a fact, or null when none was given. */
type DecisionNote = string | null

/** The batch a decision note names, or null when the fact was not applied together with others. */
type MaybeBatch = string | null

/** The batch a decision note names, or null when the fact was not applied together with others. */
export const batchIdOf = (note: DecisionNote): MaybeBatch => {
    const id = note?.startsWith(BULK_TAG) === true ? note.slice(BULK_TAG.length).split(" ")[0] : undefined
    return id === undefined || id === "" ? null : id
}

/** Whether the evidence of a fact quotes a document in the document's own words. */
const quotesDocument = (fact: FactRecord): boolean =>
    fact.evidence.some((item) => item.kind === "document" && (item.quote?.trim().length ?? 0) >= MIN_QUOTE_CHARS)

/**
 * Whether a proposal from a document can be applied together with others without a person looking at it: it sets a value (never retires
 * one), it stays internal (a bulk path never makes anything public), it disagrees with no value in force, nothing waits for a later
 * date, and the document says it in its own words. Everything else is left for a person.
 */
export const isBulkSafe = (fact: FactRecord, nowMs: number): boolean =>
    fact.status === "proposed" &&
    fact.proposalKind === "set" &&
    fact.sourceKind === "document" &&
    fact.scope === "internal" &&
    fact.conflictWith === null &&
    (fact.validFrom === null || Date.parse(fact.validFrom) <= nowMs) &&
    quotesDocument(fact)
