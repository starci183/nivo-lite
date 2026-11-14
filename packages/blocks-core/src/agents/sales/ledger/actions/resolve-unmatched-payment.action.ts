import { defineAction, type ActionDefinition, type ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { outboxPort, type OutboxApi } from "@nivo-lite/agent-sdk/mutation"
import { z } from "zod"
import {
    OTHER_INCOME_KIND,
    RESOLVE_COMMAND,
    otherIncomeDecision,
    type OtherIncomeRefusal,
} from "../rules/resolve"

import { transactionById } from "../accounting-data"
import { bookProjectJob } from "../jobs/book-project.job"
import { ledgerAppendJob } from "../jobs/ledger-append.job"
import { textOf } from "../messages/copy"
import { CLAIMS, ORDERS, TRANSACTIONS } from "../ports"
import { settleOnOrder } from "./settle.action"
import { SALES_TRANSACTION_ENTITY } from "../../../../shared/entities/sales-entity-names"

/**
 * The payload the door receives is flat: the `values` of the row command with `id` and `command` merged in (`actionPayloadOf`).
 * So the chosen order is `order` and the other-income choice is `kind`, both beside `id`; exactly one of them is given.
 */
const input: z.ZodObject<{
    id: z.ZodUUID
    command: z.ZodLiteral<typeof RESOLVE_COMMAND>
    order: z.ZodOptional<z.ZodUUID>
    kind: z.ZodOptional<z.ZodLiteral<typeof OTHER_INCOME_KIND>>
}> = z
    .object({
        id: z.uuid(),
        command: z.literal(RESOLVE_COMMAND),
        order: z.uuid().optional(),
        kind: z.literal(OTHER_INCOME_KIND).optional(),
    })
    .refine((payload) => (payload.order === undefined) !== (payload.kind === undefined), {
        message: "exactly one of order and kind",
        path: ["order"],
    })

/** The ports the resolution of an unmatched payment runs on. */
export interface ResolvePorts {
    /** The payments. */
    readonly transactions: EntityApi
    /** The orders. */
    readonly orders: EntityApi
    /** The payment claims. */
    readonly claims: EntityApi
    /** The outbox of the transaction. */
    readonly outbox: OutboxApi
}

/** What a resolution is given: the payment and the order it paid, or none for other income. */
export interface ResolveGiven {
    /** The bank transaction. */
    readonly id: string
    /** The order it paid; absent records other income. */
    readonly order?: string | undefined
}

const refused = (reason: OtherIncomeRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: textOf(`resolve_${reason}`),
    data: { reason },
})

/** Ties the payment to an order, or records it as other income, in the transaction the caller opened. */
export const resolveUnmatched = async (ports: ResolvePorts, { id, order }: ResolveGiven): Promise<ActionResult> => {
    if (order !== undefined) return settleOnOrder(ports, { transactionId: id, orderId: order })
    const decision = otherIncomeDecision(await transactionById(ports.transactions, id))
    if (decision.kind === "refuse") return refused(decision.reason)
    const { transaction } = decision
    const written = await ports.transactions.update(transaction.id, transaction.version, { status: "other_income" })
    if (!written.ok) return { ok: false, reason: "conflict", message: textOf("settle_stale") }
    await ports.outbox.enqueue(
        bookProjectJob,
        { sourceEntity: SALES_TRANSACTION_ENTITY, sourceId: transaction.id },
        { dedupeKey: `book:${SALES_TRANSACTION_ENTITY}:${transaction.id}` },
    )
    await ports.outbox.enqueue(
        ledgerAppendJob,
        { transactionId: transaction.id, orderId: null },
        { dedupeKey: `ledger:${transaction.id}` },
    )
    return { ok: true, data: { result: "other-income", transactionId: transaction.id } }
}

/**
 * `sales.resolve-unmatched-payment`: the owner resolves a payment nobody tied to an order, from its approval row. `id` is the bank
 * transaction. `order` ties it to that order through the normal payment path (the same writes and refusals as
 * `sales.settle`); `kind: "other-income"` records it as other income: the payment leaves the queue and its book entry is
 * projected. It writes records only: no door and no assistant. A payment that is gone, money out or already resolved is refused as data.
 */
export const resolveUnmatchedPaymentAction: ActionDefinition = defineAction({
    id: "sales.resolve-unmatched-payment",
    permission: "sales.manage",
    label: textOf("resolve_unmatched"),
    input,
    ports: { transactions: TRANSACTIONS, orders: ORDERS, claims: CLAIMS, outbox: outboxPort },
    transactional: true,
    refreshes: ["blocks-core.sales.api.transaction.decisions", "blocks-core.sales.api.entry.figures", "blocks-core.sales.api.entry.list", "blocks-core.sales.api.entry.ledger"],
    run: (ports, given): Promise<ActionResult> => resolveUnmatched(ports, given),
})
