/**
 * THE TRUST GATE of passages (BG3; coordinator's decision under the owner's order "the brain argues with a document before it trusts it",
 * critique P5). A passage is served to a CUSTOMER-facing search only when `knowledge_chunks.customer_ready` is true. The column defaults
 * to false, so a passage the index job stores is withheld until the shop-document critic releases it: once the document's facts are read
 * and its critique ran, every passage is released except those quoted by an OPEN high or medium point, which stay withheld until the founder
 * decides. Internal agents and the founder's "try asking" still read every passage, marked unreviewed. Rows stored before the gate were
 * backfilled true (migration 20261112013200). This file is the whole rule; the search and the critic only call it.
 */

/** The column of the gate. */
export const CUSTOMER_READY_COLUMN = "customer_ready"

/** Who a search reads for. */
export type TrustAudience = "customer" | "internal"

/** The SQL condition of a search, or null when the search adds none. */
export type TrustCondition = string | null

/**
 * The condition a CUSTOMER search adds on the passage alias (`c`): served passages only. Written on the column name, so it holds whether
 * or not the entity maps the column; with `visibility = 'public'` it is exactly the partial index `knowledge_chunks_customer`
 * (workspace_id) WHERE visibility = 'public' AND customer_ready. An internal search adds nothing.
 */
export const customerTrustWhere = (alias: string, audience: TrustAudience): TrustCondition =>
    audience === "customer" ? `${alias}.${CUSTOMER_READY_COLUMN} = true` : null

/** The select a search adds to know whether a hit was reviewed, named `customerReady` in the raw row. */
export const customerReadySelect = (alias: string): string => `${alias}.${CUSTOMER_READY_COLUMN}`

/** True when a hit an internal reader sees has not been released to customers yet: shown to the agent and the founder as unreviewed. */
export const isUnreviewed = (customerReady: unknown): boolean => customerReady !== true

/** What decides the gate of one document. */
export interface TrustGate {
    /** The hashes (`passageTextHashOf`) of the passages a finished critique read. */
    readonly reviewed: ReadonlySet<string>
    /** The hashes quoted by an open high or medium point. */
    readonly held: ReadonlySet<string>
    /**
     * True when the founder released the document although its critique could not finish. It opens nothing a critique did not read
     * (owner: the critique comes BEFORE anything reaches customers): the unreviewed passages wait for their review, which serves them
     * when it ends clean.
     */
    readonly released: boolean
}

/** Whether one passage of the document is served to customers: a finished critique read it, and no open high or medium point holds it. */
export const customerReadyOf = (hash: string, gate: TrustGate): boolean =>
    gate.reviewed.has(hash) && !gate.held.has(hash)
