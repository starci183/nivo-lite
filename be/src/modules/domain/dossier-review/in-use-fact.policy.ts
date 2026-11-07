import type { FindingEvidence, FindingInUse } from "./dossier-review.contracts"

/** The part of a fact that says whether agents read it now. */
export interface FactStanding {
    /** Where the fact stands; only an active fact is read. */
    readonly status: string
    /** The value it states. */
    readonly value: string
}

/**
 * The value agents read now for a contradiction: the value of the one fact of its evidence that is active. When none or both are
 * active (two proposals waiting, or the facts are gone) nothing is in use that the record can name, so the answer is null.
 */
export const inUseOf = (
    evidence: ReadonlyArray<FindingEvidence>,
    standings: ReadonlyMap<string, FactStanding>,
): FindingInUse | null => {
    const active = evidence.flatMap((item) => {
        const fact = item.factId === null ? undefined : standings.get(item.factId)
        return fact?.status === "active" ? [{ value: fact.value, sourceTitle: item.sourceTitle }] : []
    })
    return (active.length === 1 ? active : []).at(0) ?? null
}
