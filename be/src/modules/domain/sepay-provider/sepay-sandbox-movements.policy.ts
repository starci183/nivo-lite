import { occurredAtOf } from "./sepay-webhook.policy"
import type { SepaySandboxBody } from "./sepay-sandbox.catalogue"

/** One catalogue movement as the SePay user API lists it (the shape the live poll policy reads). */
export interface SepaySandboxRow {
    readonly id: string
    readonly occurredAt: Date
    readonly amountIn: number
    readonly amountOut: number
    readonly content: string
    readonly code: string | null
    readonly bank: string
    readonly reference: string
    readonly account: string
}

/** The row a movement is listed as: its id, booking time (Vietnam time, as SePay writes it), amount by direction, content, bank and account. */
export const sepayRowOf = (body: SepaySandboxBody): SepaySandboxRow => {
    return {
        id: String(body.id),
        occurredAt: new Date(occurredAtOf(body.transactionDate) ?? 0),
        amountIn: body.transferType === "in" ? body.transferAmount : 0,
        amountOut: body.transferType === "out" ? body.transferAmount : 0,
        content: body.content,
        code: body.code,
        bank: body.gateway,
        reference: body.referenceCode,
        account: body.accountNumber,
    }
}

/**
 * The rows of the movements the account's cases made inside a window, newest first, at most `limit`: the window rule of the live user
 * API (`from` inclusive, `to` inclusive when given). A transaction delivered twice is one movement, listed once.
 */
export const sepayRowsIn = (
    movements: ReadonlyArray<SepaySandboxBody>,
    from: Date,
    to: Date | undefined,
    limit: number,
): ReadonlyArray<SepaySandboxRow> =>
    movements
        .map(sepayRowOf)
        .filter((row) => row.occurredAt.getTime() >= from.getTime() && (to === undefined || row.occurredAt.getTime() <= to.getTime()))
        .toSorted((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
        .slice(0, Math.max(0, limit))
