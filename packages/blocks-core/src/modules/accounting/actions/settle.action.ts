import { defineAction } from "@nivo-lite/agent-sdk/block"
import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { SOURCE_TRANSACTION } from "../../../rules/accounting/posting"
import { settleDecision } from "../../../rules/accounting/settle"
import type { SettleRefusal } from "../../../rules/accounting/settle"
import type { WriteResult } from "../accounting.types"
import { textOf } from "../messages/copy"
import { claimsPort, ordersPort, outboxPort, transactionsPort } from "../ports"

const input: z.ZodObject<{
    transactionId: z.ZodUUID
    orderId: z.ZodUUID
    claimId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>
}> = z.object({
    transactionId: z.uuid(),
    orderId: z.uuid(),
    claimId: z.uuid().nullable().optional(),
})

const ports = { transactions: transactionsPort, orders: ordersPort, claims: claimsPort, outbox: outboxPort }

const refused = (reason: SettleRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: textOf(`settle_${reason}`),
    data: { reason },
})

/** What a write that did not go through means to the caller: another writer got there first, or the database refused a second link. */
const failureOf = (result: Extract<WriteResult<unknown>, { ok: false }>): ActionResult =>
    result.reason === "taken"
        ? refused("transaction_used")
        : { ok: false, reason: "conflict", message: textOf("settle_stale") }

/**
 * `payment.settle`: a payment arrived for an order. In one transaction it marks the transaction matched to the order, the order paid
 * and the claim settled (when a customer's word started it), and enqueues the three jobs that follow: the ledger line (the sheet
 * behind the door), the book entry and the notice to the customer. It never calls the door itself. Each row is written with the
 * version it was read at, and the database refuses a second link of a transaction or an order, so a double settle answers
 * `conflict` or `refused`, never pays twice. Whatever is not clean is refused as data (`refused`, `data.reason`), never marked paid;
 * the graph turns the refusal into a question for the owner. A transaction that already paid the order changes nothing.
 * It refreshes no read of its own module (the `payment` module has none): the graph runs it, not a screen. The provider must roll
 * the transaction back on any `ok: false` after the first write.
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
            transactions.get(given.transactionId),
            orders.get(given.orderId),
            claimId === null ? Promise.resolve(null) : claims.get(claimId),
        ])
        const decision = settleDecision({ transaction, order, claim }, claimId)
        if (decision.kind === "refuse") return refused(decision.reason)
        if (decision.kind === "already") return { ok: true, data: { result: "already-paid", orderId: given.orderId } }
        const matched = await transactions.settle(
            decision.transaction.id,
            decision.transaction.version,
            decision.order.id,
        )
        if (!matched.ok) return failureOf(matched)
        const paid = await orders.setStatus(decision.order.id, decision.order.version, "paid")
        if (!paid.ok) return failureOf(paid)
        if (decision.claim !== null && decision.claim.status !== "settled") {
            const answered = await claims.settle(decision.claim.id, decision.claim.version, decision.transaction.id)
            if (!answered.ok) return failureOf(answered)
        }
        const transactionId = decision.transaction.id
        await outbox.enqueue(
            "accounting.ledger-append",
            { transactionId, orderId: decision.order.id },
            { dedupeKey: `ledger:${transactionId}` },
        )
        await outbox.enqueue(
            "accounting.book-project",
            { sourceEntity: SOURCE_TRANSACTION, sourceId: transactionId },
            { dedupeKey: `book:${SOURCE_TRANSACTION}:${transactionId}` },
        )
        await outbox.enqueue(
            "payment.confirm-notice",
            { orderId: decision.order.id },
            { dedupeKey: `notice:${decision.order.id}` },
        )
        return { ok: true, data: { result: "paid", orderId: decision.order.id } }
    },
})
