/**
 * The trust gate on the WHOLE-DOCUMENT read (BR1, 2026-11-11). A customer-facing agent that reads a document's whole text
 * (`KnowledgeSourcesReadableService.readableFor`, used by the agent knowledge lens and the chat node's knowledge port) must not read
 * what the passage search withholds from it (`knowledge_chunks.customer_ready`, set by the shop-document critic): before this rule the
 * stored `knowledge_sources.content` went out whole, so a passage under an open point, or a document whose critique has not run, reached
 * the customer through this door while the search held it back.
 */

/** The trust gate of one document, as the readable statement counts it. */
export interface DocumentGate {
    /** How many passages the document has stored. */
    readonly passages: number
    /** How many of them are served to customers. */
    readonly served: number
    /** The served passages in document order, joined by `PASSAGE_JOIN`; null when none is served. */
    readonly servedText: string | null
}

/** How passages are joined when only some of them are served: one blank line, as the chunker cut them. */
export const PASSAGE_JOIN = "\n\n"

/**
 * What a customer-facing reader gets of one document: its stored text when every passage is served (unchanged behaviour for every
 * reviewed document and for documents stored before the gate, backfilled served); only its served passages, in order, when some are
 * held; nothing (null) when none is served. A document with no stored passage has nothing the gate can hold: its text as it is.
 */
export const customerTextOf = (content: string, gate: DocumentGate): string | null => {
    if (gate.passages === 0 || gate.served >= gate.passages) return content
    return gate.served === 0 ? null : (gate.servedText ?? null)
}
