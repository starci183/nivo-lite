import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EngineResult } from "@nivo-lite/agent-sdk/entity/port"
import { outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { z } from "zod"
import { SOURCE_TRANSACTION } from "../../../rules/accounting/posting"
import { settleDecision } from "../../../rules/accounting/settle"
import type { SettleRefusal } from "../../../rules/accounting/settle"
import { claimById, orderById, transactionById } from "../accounting-data"
import { bookProjectJob } from "../jobs/book-project.job"
import { confirmNoticeJob } from "../jobs/confirm-notice.job"
import { ledgerAppendJob } from "../jobs/ledger-append.job"
import { textOf } from "../messages/copy"
import { CLAIMS, ORDERS, TRANSACTIONS } from "../ports"

const input: z.ZodObject<{
    transactionId: z.ZodUUID
    orderId: z.ZodUUID
    claimId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>
}> = z.object({
    transactionId: z.uuid(),
    orderId: z.uuid(),
    claimId: z.uuid().nullable().optional(),
})

const ports = { transactions: TRANSACTIONS, orders: ORDERS, claims: CLAIMS, outbox: outboxPort }

const refused = (reason: SettleRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: textOf(`settle_${reason}`),
    data: { reason },
})

/** What each refusal of a write means for the row it wrote: a second link the database refused, or the row being gone. */
interface WriteRefusals {
    /** The refusal when the database refused a second link of the row. */
    readonly taken: SettleRefusal
    /** The refusal when the row is gone. */
    readonly missing: SettleRefusal
}

/** What a write that did not go through means to the caller: another writer got there first (`conflict`), or the refusal the row's own table says. */
const failureOf = (result: Extract<EngineResult, { readonly ok: false }>, refusals: WriteRefusals): ActionResult => {
    if (result.reason === "taken") return refused(refusals.taken)
    if (result.reason === "missing") return refused(refusals.missing)
    return { ok: false, reason: "conflict", message: textOf("settle_stale") }
}

const TRANSACTION_REFUSALS: WriteRefusals = { taken: "order_not_open", missing: "transaction_missing" }
const ORDER_REFUSALS: WriteRefusals = { taken: "order_not_open", missing: "order_missing" }
const CLAIM_REFUSALS: WriteRefusals = { taken: "transaction_used", missing: "claim_missing" }

/**
 * `payment.settle`: a payment arrived for an order. In one transaction it marks the transaction matched to the order, the order paid
 * and the claim settled (when a customer's word started it), and enqueues the three jobs that follow: the ledger line (the sheet
 * behind the door), the book entry and the notice to the customer. It never calls the door itself. Each row is written with the
 * version it was read at, and the database refuses a second link of a transaction or an order, so a double settle answers
 * `conflict` or `refused`, never pays twice. Whatever is not clean is refused as data (`refused`, `data.reason`), never marked paid;
 * the graph turns the refusal into a question for the owner. A transaction that already paid the order changes nothing.
 * It refreshes no read of its own module (the `payment` module has none): the graph runs it, not a screen. The door rolls the
 * transaction back on any `ok: false` after the first write.
 */
export const settleAction: ActionDefinition = defineAction({
    id: "payment.settle",
    permission: "payment.manage",
    label: textOf("settle"),
    input,
    ports,
    transactional: true,
    refreshes: [],
    run: async ({ transactions, orders, claims, outbox }, given): Promise<ActionResult> => {
        const claimId = given.claimId ?? null
        const [transaction, order, claim] = await Promise.all([
            transactionById(transactions, given.transactionId),
            orderById(orders, given.orderId),
            claimId === null ? Promise.resolve(null) : claimById(claims, claimId),
        ])
        const decision = settleDecision({ transaction, order, claim }, claimId)
        if (decision.kind === "refuse") return refused(decision.reason)
        if (decision.kind === "already") return { ok: true, data: { result: "already-paid", orderId: given.orderId } }
        const matched = await transactions.update(decision.transaction.id, decision.transaction.version, {
            status: "matched",
            orderId: decision.order.id,
        })
        if (!matched.ok) return failureOf(matched, TRANSACTION_REFUSALS)
        const linked = await transactions.link(decision.transaction.id, "order", decision.order.id)
        if (!linked.ok) return failureOf(linked, ORDER_REFUSALS)
        const paid = await orders.update(decision.order.id, decision.order.version, { status: "paid" })
        if (!paid.ok) return failureOf(paid, ORDER_REFUSALS)
        if (decision.claim !== null && decision.claim.status !== "settled") {
            const answered = await claims.update(decision.claim.id, decision.claim.version, {
                status: "settled",
                settledTransactionId: decision.transaction.id,
            })
            if (!answered.ok) return failureOf(answered, CLAIM_REFUSALS)
        }
        const transactionId = decision.transaction.id
        await outbox.enqueue(
            ledgerAppendJob,
            { transactionId, orderId: decision.order.id },
            { dedupeKey: `ledger:${transactionId}` },
        )
        await outbox.enqueue(
            bookProjectJob,
            { sourceEntity: SOURCE_TRANSACTION, sourceId: transactionId },
            { dedupeKey: `book:${SOURCE_TRANSACTION}:${transactionId}` },
        )
        await outbox.enqueue(
            confirmNoticeJob,
            { orderId: decision.order.id },
            { dedupeKey: `notice:${decision.order.id}` },
        )
        return { ok: true, data: { result: "paid", orderId: decision.order.id } }
    },
})
