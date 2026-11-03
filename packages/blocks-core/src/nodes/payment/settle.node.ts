import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { CONVERSATION_DINH, STORE_REAL_CASE, TRANSACTION_DINH } from "./payment.fixtures"
import { READ_CONVERSATIONS, READ_ORDERS, READ_TRANSACTIONS } from "./payment.rights"
import { AWAITING_PAYMENT, atOf } from "./payment.schemas"
import type { ConversationRow, OrderRow, SettleMode, TransactionRow } from "./payment.schemas"

/** What to settle: the transaction, whether the match is taken (`apply`) or a person decides (`ask`), the orders named and the reasons. */
interface SettleInput {
    readonly transactionId: string
    readonly mode: SettleMode
    readonly candidateIds: ReadonlyArray<string>
    readonly reasons: ReadonlyArray<string>
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
})
const output: z.ZodType<SettleOutput, SettleOutput> = z.object({
    result: z.enum(["paid", "already-paid", "raised"]),
    orderId: z.string().nullable(),
})

const AMOUNT = new Intl.NumberFormat("vi-VN")

const filled = (template: string, order: OrderRow): string =>
    template.replace("{orderNo}", order.orderNo).replace("{amount}", AMOUNT.format(order.amountVnd ?? 0))

/** The conversation the customer wrote in last, if they wrote in any. */
const conversationOf = async (context: NodeContext, leadId: string | null): Promise<ConversationRow | undefined> => {
    if (leadId === null) return undefined
    const rows = await context.data.read<ConversationRow>("conversation", {
        where: { leadId },
        fields: READ_CONVERSATIONS.fields,
        limit: 20,
    })
    return rows.toSorted((left, right) => atOf(right.lastMessageAt ?? 0) - atOf(left.lastMessageAt ?? 0))[0]
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
            amountVnd,
        },
        { dedupeKey: `payment-review:${given.transactionId}` },
    )
    return { result: "raised", orderId: null }
}

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
        const amount = transaction?.amountVnd ?? null
        const [orderId] = given.candidateIds
        if (given.mode === "ask" || transaction === undefined || orderId === undefined || given.candidateIds.length !== 1) {
            return raise(context, given, settings, amount, given.reasons)
        }
        if (transaction.orderId === orderId) return { result: "already-paid", orderId }
        const [order] = await context.data.read<OrderRow>("order", {
            where: { id: orderId },
            fields: READ_ORDERS.fields,
            limit: 1,
        })
        const open = order !== undefined && AWAITING_PAYMENT.includes(order.status) && order.amountVnd === amount
        if (order === undefined || !open || transaction.orderId !== null) {
            return raise(context, given, settings, amount, [...given.reasons, "order_not_open"])
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
                { conversationId: conversation.id, text: filled(settings.confirmationText, order) },
                { dedupeKey: `payment-confirmation:${order.id}` },
            )
        }
        return { result: "paid", orderId: order.id }
    },
    examples: [
        {
            name: "the judge matched Định's order: it is marked paid with the 5,000 transaction and he is told on Zalo",
            params: { confirmationText: "Shop đã nhận {amount} đ cho đơn {orderNo}. Cảm ơn bạn!", reviewTitle: "Kiểm tra khoản tiền" },
            input: {
                transactionId: TRANSACTION_DINH.id,
                mode: "apply",
                candidateIds: ["order-dinh"],
                reasons: ["Tên, số tiền và lời báo của khách khớp"],
            },
            output: { result: "paid", orderId: "order-dinh" },
            effects: [
                {
                    kind: "payment.mark-paid",
                    payload: {
                        orderId: "order-dinh",
                        transactionId: TRANSACTION_DINH.id,
                        evidence: ["Tên, số tiền và lời báo của khách khớp"],
                    },
                },
                {
                    kind: "channel.send",
                    payload: { conversationId: CONVERSATION_DINH.id, text: "Shop đã nhận 5.000 đ cho đơn SO-0001. Cảm ơn bạn!" },
                },
            ],
            store: STORE_REAL_CASE,
        },
        {
            name: "a transaction that already paid the order changes nothing",
            params: { confirmationText: "Shop đã nhận {amount} đ cho đơn {orderNo}.", reviewTitle: "Kiểm tra khoản tiền" },
            input: { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: ["order-dinh"], reasons: [] },
            output: { result: "already-paid", orderId: "order-dinh" },
            effects: [],
            store: {
                ...STORE_REAL_CASE,
                "bank-transaction": [{ ...TRANSACTION_DINH, orderId: "order-dinh", status: "matched" }],
            },
        },
        {
            name: "an ambiguous case is never marked paid: the owner gets a work item",
            params: { confirmationText: "Shop đã nhận {amount} đ cho đơn {orderNo}.", reviewTitle: "Kiểm tra khoản tiền" },
            input: { transactionId: TRANSACTION_DINH.id, mode: "ask", candidateIds: ["order-dinh", "order-2"], reasons: ["Hai đơn cùng số tiền"] },
            output: { result: "raised", orderId: null },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "reconcile_payment",
                        title: "Kiểm tra khoản tiền",
                        payload: {
                            target: "order",
                            transactionId: TRANSACTION_DINH.id,
                            candidateIds: ["order-dinh", "order-2"],
                            reasons: ["Hai đơn cùng số tiền"],
                        },
                        amountVnd: 5000,
                    },
                },
            ],
            store: STORE_REAL_CASE,
        },
        {
            name: "an order that is no longer open is not paid twice: the owner gets a work item",
            params: { confirmationText: "Shop đã nhận {amount} đ cho đơn {orderNo}.", reviewTitle: "Kiểm tra khoản tiền" },
            input: { transactionId: TRANSACTION_DINH.id, mode: "apply", candidateIds: ["order-dinh"], reasons: ["khớp"] },
            output: { result: "raised", orderId: null },
            effects: ["work-item.raise"],
            store: { ...STORE_REAL_CASE, order: [{ ...STORE_REAL_CASE.order?.[0], status: "paid" }] },
        },
    ],
})
