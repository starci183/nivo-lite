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

/**
 * How many cards of the owner's review the waiting proposals make, the way the review lists them: one card per key (subject and
 * attribute). Competing values, a "stop using" beside them, or values that say the same thing in other words are one card: the owner
 * chooses or approves once per key. Counting keys keeps the number independent of how two values are compared, so the rail and the
 * page that groups the same proposals always agree.
 */
export const waitingCardCount = (proposals: ReadonlyArray<WaitingProposal>): number =>
    new Set(proposals.map(keyOf)).size
