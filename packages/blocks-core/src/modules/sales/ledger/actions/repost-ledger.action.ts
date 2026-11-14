import { defineAction, type ActionDefinition, type ActionResult } from "@nivo-lite/agent-sdk/block"
import { outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { z } from "zod"
import { repostDecision, type RepostRefusal } from "../../../../rules/sales/ledger/ledger-repost"
import { orderById, transactionById } from "../accounting-data"
import { ledgerAppendJob } from "../jobs/ledger-append.job"
import { textOf } from "../messages/copy"
import { ORDERS, TRANSACTIONS } from "../ports"

const input: z.ZodObject<{ id: z.ZodUUID }> = z.object({ id: z.uuid() })

const refused = (reason: RepostRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: textOf(`repost_${reason}`),
    data: { reason },
})

/** The part of the clock that tells one press from the next: a press in the same minute is the same job. */
const minuteOf = (now: Date): string => now.toISOString().slice(0, 16)

/**
 * `sales.repost-ledger`: the owner asks for the ledger line of a paid order to be written again (the first job ended without a
 * line: no ledger was connected yet, or the sheet was refused). `id` is the payment. It enqueues a NEW ledger append job for that
 * payment and its order, and writes nothing else. It is safe to press again: the ledger writes a transaction once whatever the number
 * of jobs, so a payment already in the sheet is a no-op and a row is never duplicated. A payment that is gone, or paid no paid order,
 * is refused as data.
 */
export const repostLedgerAction: ActionDefinition = defineAction({
    id: "sales.repost-ledger",
    permission: "sales.manage",
    label: textOf("repost_open"),
    input,
    ports: { transactions: TRANSACTIONS, orders: ORDERS, outbox: outboxPort },
    transactional: true,
    refreshes: [],
    run: async ({ transactions, orders, outbox }, { id }, context): Promise<ActionResult> => {
        const transaction = await transactionById(transactions, id)
        const orderId = transaction?.orderId ?? null
        const order = orderId === null ? null : await orderById(orders, orderId)
        const decision = repostDecision(transaction, order)
        if (decision.kind === "refuse") return refused(decision.reason)
        await outbox.enqueue(
            ledgerAppendJob,
            { transactionId: decision.transaction.id, orderId: decision.order.id },
            { dedupeKey: `ledger-repost:${decision.transaction.id}:${minuteOf(context.now)}` },
        )
        return { ok: true, data: { result: "queued", transactionId: decision.transaction.id } }
    },
})
