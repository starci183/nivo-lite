import { mentionsName } from "@nivo-lite/agent-sdk/reconcile"
import { atOf } from "./payment.schemas"
import type { ClaimRow, TransactionRow } from "./payment.schemas"

/** What a transaction of the feed is worth as the money of a claim: the amount it names, the name on the transfer, and how near in time. */
const AMOUNT_POINTS = 40
const NAME_POINTS = 25

/** The words a transaction carries to compare names with: the transfer content and the name the bank gave. */
const wordsOf = (row: TransactionRow): string => `${row.reference} ${row.payer ?? ""}`

/** The names a claim gives, with the customer's own name when known. */
const namesOf = (claim: ClaimRow, leadName: string | null): ReadonlyArray<string> =>
    leadName === null ? claim.names : [...claim.names, leadName]

/**
 * The transaction of the feed that a customer's claim most likely speaks of, or undefined when none does. Only an unmatched transaction
 * inside the window around the claim counts. A claim that names an amount needs a transaction of exactly that amount; one that names none
 * needs the customer's name (the one they gave, or the name of their record) in the transfer. Among those, the amount and the name raise the
 * score, and the nearest in time wins a tie.
 */
export const bestTransaction = (
    claim: ClaimRow,
    leadName: string | null,
    rows: ReadonlyArray<TransactionRow>,
    windowMs: number,
): TransactionRow | undefined => {
    const claimedAt = atOf(claim.claimedAt)
    const names = namesOf(claim, leadName)
    const scored = rows
        .filter((row) => row.orderId === null && Math.abs(atOf(row.occurredAt) - claimedAt) <= windowMs)
        .map((row) => {
            const amount = claim.amountVnd !== null && claim.amountVnd === row.amountVnd
            const name = names.some((one) => mentionsName(wordsOf(row), one))
            return {
                row,
                eligible: claim.amountVnd === null ? name : amount,
                score: (amount ? AMOUNT_POINTS : 0) + (name ? NAME_POINTS : 0),
                distance: Math.abs(atOf(row.occurredAt) - claimedAt),
            }
        })
        .filter((one) => one.eligible)
        .toSorted((left, right) => right.score - left.score || left.distance - right.distance)
    return scored[0]?.row
}
