import { sameValue } from "./fact-key.policy"

/** A proposal waiting for the owner, as far as counting its card needs it. */
export interface WaitingProposal {
    /** The subject key. */
    readonly subjectKey: string
    /** The attribute key. */
    readonly attribute: string
    /** The proposed value as text. */
    readonly value: string
    /** Whether it sets a value or retires the current one. */
    readonly proposalKind: string
}

/** The key proposals are grouped on: the subject and the attribute. */
const keyOf = (proposal: Pick<WaitingProposal, "subjectKey" | "attribute">): string =>
    `${proposal.subjectKey}|${proposal.attribute}`

/** How many distinct values a list holds, two values that say the same thing counting once. */
const distinctValues = (values: ReadonlyArray<string>): number =>
    values.filter((value, index) => values.findIndex((other) => sameValue(other, value)) === index).length

/**
 * How many cards of the owner's review the waiting proposals make, the way the review board lists them: proposals of one key with two or
 * more different values, or with a "stop using" beside them, are one card; every other proposal that sets a value is its own card; a
 * "stop using" proposal with no competing value is its own card.
 */
export const waitingCardCount = (proposals: ReadonlyArray<WaitingProposal>): number => {
    const sets = new Map<string, Array<string>>()
    const retiring = new Set<string>()
    for (const proposal of proposals) {
        const key = keyOf(proposal)
        if (proposal.proposalKind === "retire") retiring.add(key)
        else sets.set(key, [...(sets.get(key) ?? []), proposal.value])
    }
    let cards = [...retiring].filter((key) => !sets.has(key)).length
    for (const [key, values] of sets) {
        cards += distinctValues(values) >= 2 || retiring.has(key) ? 1 : values.length
    }
    return cards
}
