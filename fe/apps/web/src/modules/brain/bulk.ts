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

/** The shortest verbatim quote that counts as the document saying it (the back end judges the same way). */
const MIN_QUOTE_CHARS = 8

/** The words of a fact that name the value it sets: another fact with the same key makes it a choice for a person. */
const keyOf = (fact: BrainFact): string => `${fact.subjectKey}|${fact.attribute}|${fact.installationId ?? ""}`

/** Whether the document quotes the fact in its own words. */
const quotedBy = (fact: BrainFact, sourceId: string): boolean =>
    fact.evidence.some(
        (proof) =>
            proof.kind === "document" && proof.ref === sourceId && (proof.quote?.trim().length ?? 0) >= MIN_QUOTE_CHARS,
    )

/**
 * How many facts a document proposed that the apply-together path will take: the ones that set an internal value the document quotes,
 * with no other value waiting or in force for the same key and no later start date. A conflicted fact is left out; it stays for a
 * person. The back end decides again, so this is the count the confirmation shows, not the authority.
 */
export const safeFactCountOf = (facts: ReadonlyArray<BrainFact>, sourceId: string, nowMs: number): number => {
    const taken = new Map<string, number>()
    for (const fact of facts) {
        if (fact.status === "proposed" || fact.status === "active")
            taken.set(keyOf(fact), (taken.get(keyOf(fact)) ?? 0) + 1)
    }
    return facts.filter(
        (fact) =>
            fact.status === "proposed" &&
            fact.proposalKind === "set" &&
            fact.sourceKind === "document" &&
            fact.scope === "internal" &&
            (fact.validFrom === null || Date.parse(fact.validFrom) <= nowMs) &&
            quotedBy(fact, sourceId) &&
            taken.get(keyOf(fact)) === 1,
    ).length
}
