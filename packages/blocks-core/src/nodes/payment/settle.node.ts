import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { channelSendEffect, paymentMarkPaidEffect } from "../../vocabulary"
import {
    CONVERSATION_DINH,
    ORDER_DINH,
    STORE_EXTENDED,
    STORE_REAL_CASE,
    TRANSACTION_DINH,
    TRANSACTION_LINKED,
    TRANSACTION_NAMED,
} from "./payment.fixtures"
import { READ_CONVERSATIONS, READ_ORDERS, READ_TRANSACTIONS } from "./payment.rights"
import { AWAITING_PAYMENT, atOf } from "./payment.schemas"
import type { ConversationRow, OrderRow, SettleMode, TransactionRow } from "./payment.schemas"

/** What to settle: the transaction, whether the match is taken (`apply`) or a person decides (`ask`), the orders named and the reasons. */
interface SettleInput {
    readonly transactionId: string
    readonly mode: SettleMode
    readonly candidateIds: ReadonlyArray<string>
    readonly reasons: ReadonlyArray<string>
    /** The claim this reconciliation answers, when a customer's word started it; the work item for the owner carries it. */
    readonly claimId: string | null
}

/** `paid`: the order was marked paid. `already-paid`: this transaction had paid it before. `raised`: the owner was asked. */
interface SettleOutput {
    readonly result: "paid" | "already-paid" | "raised"
    readonly orderId: string | null
}

/** The words the settlement says: the template of the confirmation (`{orderNo}` and `{amount}` are filled) and the title of the owner's work item. */
interface SettleParams {
    readonly confirmationText: string
    readonly reviewTitle: string
}

const params: z.ZodType<SettleParams> = z.object({ confirmationText: z.string().min(1), reviewTitle: z.string().min(1) })
const input: z.ZodType<SettleInput, SettleInput> = z.object({
    transactionId: z.string(),
    mode: z.enum(["apply", "ask"]),
    candidateIds: z.array(z.string()),
    reasons: z.array(z.string()),
    claimId: z.string().nullable(),
})
const output: z.ZodType<SettleOutput, SettleOutput> = z.object({
    result: z.enum(["paid", "already-paid", "raised"]),
    orderId: z.string().nullable(),
})

const AMOUNT = new Intl.NumberFormat("vi-VN")

const filled = (template: string, orderNo: string, amountVnd: number): string =>
    template.replace("{orderNo}", orderNo).replace("{amount}", AMOUNT.format(amountVnd))

/** When a conversation last had a message; one with none is the oldest. */
const lastAt = (conversation: ConversationRow): number =>
    conversation.lastMessageAt === null ? 0 : atOf(conversation.lastMessageAt)

/** The conversation the customer wrote in last, if they wrote in any. */
const conversationOf = async (context: NodeContext, leadId: string): Promise<ConversationRow | undefined> => {
    const rows = await context.data.read<ConversationRow>("conversation", {
        where: { leadId },
        fields: READ_CONVERSATIONS.fields,
        limit: 20,
    })
    return rows.toSorted((left, right) => lastAt(right) - lastAt(left))[0]
}

const raise = async (
    context: NodeContext,
    given: SettleInput,
    settings: SettleParams,
    amountVnd: number | null,
    reasons: ReadonlyArray<string>,
): Promise<SettleOutput> => {
    await context.effect(
        "work-item.raise",
        {
            action: "reconcile_payment",
            title: settings.reviewTitle,
            payload: { target: "order", transactionId: given.transactionId, candidateIds: given.candidateIds, reasons },
            ...(amountVnd === null ? {} : { amountVnd }),
            ...(given.claimId === null ? {} : { claimId: given.claimId }),
        },
        { dedupeKey: `payment-review:${given.transactionId}` },
    )
    return { result: "raised", orderId: null }
}

const SETTINGS = { confirmationText: "Shop đã nhận {amount} đ cho đơn {orderNo}. Cảm ơn bạn!", reviewTitle: "Kiểm tra khoản tiền" }
const REASONS = ["Tên, số tiền và lời báo của khách khớp"]

/** The agent's grant in the examples: the node's own rights, and what the effects it runs need (the host checks the grant for them). */
const GRANT = { rights: [...paymentMarkPaidEffect.rights, ...channelSendEffect.rights, READ_TRANSACTIONS, READ_ORDERS, READ_CONVERSATIONS] }

/**
 * The end of a reconciliation. `apply` marks the one named order paid with the transaction (`payment.mark-paid`) and tells the customer on
 * the channel they wrote from (`channel.send`). It is idempotent: a transaction that already paid the order changes nothing, and a
 * transaction pays one order only. Whatever is not clean (the mode is `ask`, the order is not one, is no longer open, has another amount,
 * or the transaction already paid another order) is never marked paid: it raises a work item for the owner (`work-item.raise`).
 */
export const paymentSettleNode: NodeDefinition<
    z.ZodType<SettleInput, SettleInput>,
    z.ZodType<SettleOutput, SettleOutput>,
    z.ZodType<SettleParams>
> = defineNode({
    id: "payment.settle",
    role: "output",
    title: { key: "paymentSettle" },
    params,
    input,
    output,
    rights: [READ_TRANSACTIONS, READ_ORDERS, READ_CONVERSATIONS],
    effects: ["payment.mark-paid", "channel.send", "work-item.raise"],
    run: async (given, context) => {
        const settings = context.params
        const [transaction] = await context.data.read<TransactionRow>("bank-transaction", {
            where: { id: given.transactionId },
            fields: READ_TRANSACTIONS.fields,
            limit: 1,
        })
        const [orderId] = given.candidateIds
        if (given.mode === "ask" || transaction === undefined || orderId === undefined || given.candidateIds.length !== 1) {
            return raise(context, given, settings, transaction?.amountVnd ?? null, given.reasons)
        }
        if (transaction.orderId === orderId) return { result: "already-paid", orderId }
        const [order] = await context.data.read<OrderRow>("order", {
            where: { id: orderId },
            fields: READ_ORDERS.fields,
            limit: 1,
        })
        const open = order !== undefined && AWAITING_PAYMENT.includes(order.status) && order.amountVnd === transaction.amountVnd
        if (order === undefined || !open || transaction.orderId !== null) {
            return raise(context, given, settings, transaction.amountVnd, [...given.reasons, "order_not_open"])
        }
        await context.effect(
            "payment.mark-paid",
            { orderId: order.id, transactionId: transaction.id, evidence: given.reasons },
            { dedupeKey: `paid:${transaction.id}` },
        )
        const conversation = await conversationOf(context, order.leadId)
        if (conversation !== undefined) {
            await context.effect(
                "channel.send",
                { conversationId: conversation.id, text: filled(settings.confirmationText, order.orderNo, transaction.amountVnd) },
                { dedupeKey: `payment-confirmation:${order.id}` },
            )
        }
        return { result: "paid", orderId: order.id }
    },
    examples: [
        {
            name: "the judge matched Định's order: it is marked paid with the 5,000 transaction and he is told on Zalo, in his latest conversation",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: [ORDER_DINH.id], reasons: REASONS, claimId: null },
            output: { result: "paid", orderId: ORDER_DINH.id },
            effects: [
                {
                    kind: "payment.mark-paid",
                    payload: { orderId: ORDER_DINH.id, transactionId: TRANSACTION_DINH.id, evidence: REASONS },
                },
                {
                    kind: "channel.send",
                    payload: { conversationId: CONVERSATION_DINH.id, text: "Shop đã nhận 5.000 đ cho đơn SO-0001. Cảm ơn bạn!" },
                },
            ],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
        {
            name: "a customer who never wrote is marked paid and told nothing",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_NAMED.id, mode: "apply", candidateIds: ["order-2"], reasons: ["khớp"], claimId: null },
            output: { result: "paid", orderId: "order-2" },
            effects: [
                { kind: "payment.mark-paid", payload: { orderId: "order-2", transactionId: TRANSACTION_NAMED.id, evidence: ["khớp"] } },
            ],
            store: STORE_EXTENDED,
            grant: GRANT,
        },
        {
            name: "a transaction that already paid the order changes nothing",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: [ORDER_DINH.id], reasons: [], claimId: null },
            output: { result: "already-paid", orderId: ORDER_DINH.id },
            effects: [],
            store: {
                ...STORE_REAL_CASE,
                "bank-transaction": [{ ...TRANSACTION_DINH, orderId: ORDER_DINH.id, status: "matched" }],
            },
            grant: GRANT,
        },
        {
            name: "an ambiguous case from a claim is never marked paid: the owner gets a work item that carries the claim",
            params: SETTINGS,
            input: {
                transactionId: TRANSACTION_DINH.id,
                mode: "ask",
                candidateIds: [ORDER_DINH.id, "order-2"],
                reasons: ["Hai đơn cùng số tiền"],
                claimId: "claim-dinh",
            },
            output: { result: "raised", orderId: null },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "reconcile_payment",
                        title: SETTINGS.reviewTitle,
                        payload: {
                            target: "order",
                            transactionId: TRANSACTION_DINH.id,
                            candidateIds: [ORDER_DINH.id, "order-2"],
                            reasons: ["Hai đơn cùng số tiền"],
                        },
                        amountVnd: 5000,
                        claimId: "claim-dinh",
                    },
                },
            ],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
        {
            name: "a transaction that is not found raises a work item with no amount",
            params: SETTINGS,
            input: { transactionId: "missing", mode: "apply", candidateIds: [ORDER_DINH.id], reasons: [], claimId: null },
            output: { result: "raised", orderId: null },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "reconcile_payment",
                        title: SETTINGS.reviewTitle,
                        payload: { target: "order", transactionId: "missing", candidateIds: [ORDER_DINH.id], reasons: [] },
                    },
                },
            ],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
        {
            name: "an order that is no longer open is not paid twice",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: [ORDER_DINH.id], reasons: ["khớp"], claimId: null },
            output: { result: "raised", orderId: null },
            effects: ["work-item.raise"],
            store: { ...STORE_REAL_CASE, order: [{ ...ORDER_DINH, status: "paid" }] },
            grant: GRANT,
        },
        {
            name: "an order with another amount than the transaction is not marked paid",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: ["order-2"], reasons: ["khớp"], claimId: null },
            output: { result: "raised", orderId: null },
            effects: ["work-item.raise"],
            store: STORE_EXTENDED,
            grant: GRANT,
        },
        {
            name: "a named order that does not exist is not marked paid",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: ["ghost"], reasons: ["khớp"], claimId: null },
            output: { result: "raised", orderId: null },
            effects: ["work-item.raise"],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
        {
            name: "a transaction that already paid another order pays no second one",
            params: SETTINGS,
            input: { transactionId: TRANSACTION_LINKED.id, mode: "apply", candidateIds: [ORDER_DINH.id], reasons: ["khớp"], claimId: null },
            output: { result: "raised", orderId: null },
            effects: ["work-item.raise"],
            store: STORE_EXTENDED,
            grant: GRANT,
        },
    ],
})
