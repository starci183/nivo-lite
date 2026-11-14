import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { declaredPayloadOf } from "@modules/domain/trigger-specs"

/**
 * The neutral one-credit shape (`nivo.tool.payment.credit.get`) of the raw `<provider>.transaction` row of a bank feed. SePay, Casso and
 * payOS declare ONE row shape (purpose `bank.transaction`, `bank-feed.data-types.ts`), so ONE mapper serves all three: the members the bank
 * trigger's fill reads from the same row (`TriggerSpec.reads` of `payment.credit.received`, through `declaredPayloadOf`) plus the
 * direction. A provider whose row differs declares another purpose and is mapped on its own. No business knowledge: the row's money fields
 * as stored.
 */

/** The purpose tag of the raw bank-move row type every bank feed declares. */
export const BANK_TRANSACTION_PURPOSE = "bank.transaction"

/** One bank move in the neutral shape: only the members the row holds. */
export interface Credit {
    /** The provider's own id of the move (what was asked: the bank trigger's `data.transactionId`, the row's key). */
    readonly id: string
    /** `in` for money received, `out` for money that went out. */
    readonly direction: "in" | "out"
    /** The amount, in VND. */
    readonly amountVnd: number
    /** The transfer content as the bank reported it. */
    readonly content: string
    /** When it happened, ISO 8601. */
    readonly at: string
    /** The bank account it moved on, when the row names it. */
    readonly account?: string
    /** The bank's own reference, when the row names it. */
    readonly bankRef?: string
}

/** The direction of a raw row (`credit` / `debit` as the feeds store it), or null for any other word. */
const directionOf = (raw: unknown): Credit["direction"] | null => {
    if (raw === "credit") return "in"
    return raw === "debit" ? "out" : null
}

/**
 * The credit a raw bank row holds, or null when the row is no bank move (no whole amount, no content, a direction that is neither
 * `credit` nor `debit`). `at` is the row's own, else the moment the row entered the store.
 */
export const creditOf = (id: string, value: Readonly<Record<string, unknown>>, occurredAt: Date): Credit | null => {
    const direction = directionOf(value.direction)
    const filled = declaredPayloadOf(TRIGGER.paymentCreditReceived, value)
    const { amountVnd, content, at, account, bankRef } = filled
    if (direction === null || typeof amountVnd !== "number" || !Number.isInteger(amountVnd) || typeof content !== "string") return null
    return {
        id,
        direction,
        amountVnd,
        content,
        at: typeof at === "string" ? at : occurredAt.toISOString(),
        ...(typeof account === "string" ? { account } : {}),
        ...(typeof bankRef === "string" ? { bankRef } : {}),
    }
}
