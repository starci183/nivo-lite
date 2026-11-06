import { decideByCode, scoreCandidates } from "@nivo-lite/agent-sdk/reconcile"
import type { Arrival, Candidate, Evidenced } from "@nivo-lite/agent-sdk/reconcile"
import type { OrderRecord, TransactionRecord } from "./accounting.types"
import { AWAITING_PAYMENT } from "./settle"

const DAY_MS = 86_400_000

/** The point in time a re-match looks back to: `days` days before `now`, ISO text. */
export const sinceOf = (now: string, days: number): string => new Date(Date.parse(now) - days * DAY_MS).toISOString()

/** The order as the candidate a credit may settle: the code is its number, the amount due is its amount. Null for an order that no longer waits or has no amount. */
export const candidateOf = (order: OrderRecord): Candidate | null =>
    order.amountVnd === null || !AWAITING_PAYMENT.includes(order.status)
        ? null
        : {
              id: order.id,
              label: order.orderNo,
              amountDue: order.amountVnd,
              partyName: null,
              partyKey: null,
              codes: [order.orderNo],
              openedAt: 0,
          }

/** The credit as an arrival, the same way the arrival path reads a transaction: its amount, its transfer content and the name the bank gave. */
export const arrivalOf = (credit: TransactionRecord): Arrival => ({
    id: credit.id,
    amount: credit.amountVnd,
    text: credit.reference ?? "",
    names: credit.payer === null ? [] : [credit.payer],
    at: Date.parse(credit.occurredAt),
})

/** What the re-match of one order makes of the credits it swept. */
export interface RematchPlan {
    /** The one credit to settle on the order; null when none, or when more than one matched. */
    readonly settle: TransactionRecord | null
    /** The credits that name the code with another amount: a partial or an over payment, for a person. */
    readonly wrongAmount: ReadonlyArray<TransactionRecord>
    /** The credits that name the code with the amount due when more than one did: none is settled, a person chooses. */
    readonly ambiguous: ReadonlyArray<TransactionRecord>
}

const NONE: RematchPlan = { settle: null, wrongAmount: [], ambiguous: [] }

/** The evidence of one credit against the order, as the arrival path gathers it. */
const evidenceOf = (credit: TransactionRecord, candidate: Candidate): ReadonlyArray<Evidenced> =>
    scoreCandidates(arrivalOf(credit), [candidate], [], { windowMs: Number.MAX_SAFE_INTEGER })

/**
 * What to do with the credits of the window now that an order has a payment code. Each credit is judged by the same code rule the arrival
 * path uses: a credit that names the code with exactly the amount due may settle the order, one that names it with another amount is for
 * a person, and one that does not name it is not about this order. Only money in that is still unmatched counts. When two or more credits
 * name the code with the amount due, none is settled.
 */
export const rematchOf = (order: OrderRecord, credits: ReadonlyArray<TransactionRecord>): RematchPlan => {
    const candidate = candidateOf(order)
    if (candidate === null) return NONE
    const judged = credits
        .filter((credit) => credit.direction === "credit" && credit.status === "unmatched")
        .map((credit) => ({ credit, outcome: decideByCode(evidenceOf(credit, candidate)) }))
    const fits = judged.filter((one) => one.outcome?.effect.kind === "apply").map((one) => one.credit)
    const wrongAmount = judged.filter((one) => one.outcome?.effect.kind === "ask").map((one) => one.credit)
    const [only] = fits
    return fits.length === 1 && only !== undefined
        ? { settle: only, wrongAmount, ambiguous: [] }
        : { settle: null, wrongAmount, ambiguous: fits }
}

const AMOUNT = new Intl.NumberFormat("vi-VN")

/** A question template with its `{name}` placeholders filled. */
export const questionText = (template: string, values: Readonly<Record<string, string | number>>): string =>
    Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)

/** An amount as the questions write it. */
export const amountText = (amountVnd: number): string => AMOUNT.format(amountVnd)

/** The source a question about one credit that names a code with another amount is asked under: asked once per credit. */
export const wrongAmountSource = (transactionId: string): string => `rematch:amount:${transactionId}`

/** The source a question about several credits that name one code is asked under: asked once per order. */
export const ambiguousSource = (orderId: string): string => `rematch:many:${orderId}`
