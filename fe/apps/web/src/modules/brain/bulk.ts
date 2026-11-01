import type { BrainFact } from "@/modules/types"

/** What the note of a fact applied together with others starts with; the rest, up to a space, is the batch. */
const BULK_TAG = "bulk:"

/** The batch a decision note names, or null when the fact was not applied together with others. */
const batchIdOf = (note: string | null): string | null => {
    const id = note?.startsWith(BULK_TAG) === true ? note.slice(BULK_TAG.length).split(" ")[0] : undefined
    return id === undefined || id === "" ? null : id
}

/** Whether the evidence of a fact cites the document. */
const citesDocument = (fact: BrainFact, sourceId: string): boolean =>
    fact.evidence.some((proof) => proof.kind === "document" && proof.ref === sourceId)

/**
 * How many internal values a document proposed that still wait for a person: the facts the apply-together path may take (the back end
 * checks each one again and leaves the ones that are not safe).
 */
export const waitingFactCountOf = (facts: ReadonlyArray<BrainFact>, sourceId: string): number =>
    facts.filter(
        (fact) =>
            fact.status === "proposed" &&
            fact.proposalKind === "set" &&
            fact.scope === "internal" &&
            citesDocument(fact, sourceId),
    ).length

/** The batch of the facts of a document that were applied together and are still in force, the latest one; null when there is none. */
export const appliedBatchOf = (facts: ReadonlyArray<BrainFact>, sourceId: string): string | null => {
    const applied = facts
        .filter(
            (fact) =>
                fact.status === "active" && batchIdOf(fact.decisionNote) !== null && citesDocument(fact, sourceId),
        )
        .sort((left, right) => (right.decidedAt ?? "").localeCompare(left.decidedAt ?? ""))
    return batchIdOf(applied[0]?.decisionNote ?? null)
}
