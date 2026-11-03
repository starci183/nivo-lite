import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { PaymentInstruction } from "../../vocabulary"
import type { OrderLine } from "./payment-request.policy"
import { noAccountTitleOf, paymentMessageOf, transferContentOf } from "./payment-request.policy"
import type { RequestLocale } from "./payment-request.messages"
import type { NodeSchema } from "../order/order.schema"

/** The confirmed order to be paid, and where to tell the customer. */
export interface PaymentRequestInput {
    /** The order. */
    readonly orderId: string
    /** The conversation the customer is in. */
    readonly conversationId: string
    /** The language of the message. */
    readonly locale: RequestLocale
}

/** What came of the request. */
export interface PaymentRequestOutput {
    /** `sent`: the message went to the customer; `no_account`: no provider answered, the owner was told; `not_payable`: the order is not confirmed or has no amount. */
    readonly status: "sent" | "no_account" | "not_payable"
    /** The transfer content, or null when nothing was sent. */
    readonly content: string | null
    /** The QR link the provider tool drew, or null when nothing was sent. */
    readonly qrUrl: string | null
}

/** The order as the order data port reads it. */
interface PayableOrder {
    readonly orderNo: string
    readonly amountVnd: number | null
    readonly status: string
    readonly items: ReadonlyArray<OrderLine>
}

/** The NIVO MCP tool that answers how to pay: the account of the connected provider and the QR link of the transfer. */
const INSTRUCTION_TOOL = "payment.instruction" as const

const params: z.ZodObject<Record<string, never>> = z.object({})

const input: NodeSchema<PaymentRequestInput> = z.object({
    orderId: z.string().min(1),
    conversationId: z.string().min(1),
    locale: z.enum(["vi", "en"]),
})

const output: NodeSchema<PaymentRequestOutput> = z.object({
    status: z.enum(["sent", "no_account", "not_payable"]),
    content: z.string().nullable(),
    qrUrl: z.string().nullable(),
})

const NOT_SENT: Omit<PaymentRequestOutput, "status"> = { content: null, qrUrl: null }

/** What the provider tool answered, or null when it failed or no provider is connected. */
const instructionOf = async (
    tools: NodeContext["tools"],
    args: Readonly<Record<string, unknown>>,
): Promise<PaymentInstruction | null> => {
    try {
        return await tools.call<PaymentInstruction>(INSTRUCTION_TOOL, args)
    } catch {
        return null
    }
}

/**
 * `payment.request`: asks the customer to pay a confirmed order. The business rules are here: only a confirmed order with an amount,
 * the order number reduced to letters and digits as the transfer content, and one request per order across runs (dedupe key
 * `payment-request:<orderId>`). The account and the QR link come from the `payment.instruction` tool; when it fails or no provider is
 * connected, nothing is sent and a work item (`connect_sepay`) goes to the owner.
 */
export const paymentRequestNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "payment.request",
    role: "output",
    title: { vi: "Gửi yêu cầu thanh toán", en: "Send the payment request" },
    params,
    input,
    output,
    rights: [
        { kind: "order", access: "read", scope: "turn", fields: ["id", "orderNo", "amountVnd", "status", "items"] },
        { kind: "message", access: "write", scope: "turn", fields: ["body"] },
        // The grant must cover the rights of the tool it calls; the node itself never reads the account.
        { kind: "payment-account", access: "read", scope: "workspace", fields: ["bankName", "bankCode", "accountNumber", "accountHolder"] },
    ],
    effects: ["channel.send", "work-item.raise"],
    tools: [INSTRUCTION_TOOL],
    run: async (given, context) => {
        const [order] = await context.data.read<PayableOrder>("order", {
            where: { id: given.orderId },
            fields: ["orderNo", "amountVnd", "status", "items"],
            limit: 1,
        })
        const amountVnd = order?.amountVnd ?? 0
        if (order === undefined || order.status !== "confirmed" || amountVnd <= 0) {
            return { status: "not_payable", ...NOT_SENT }
        }
        const content = transferContentOf(order.orderNo)
        const instruction = await instructionOf(context.tools, { orderNo: order.orderNo, amountVnd, transferContent: content })
        if (instruction === null) {
            await context.effect("work-item.raise", {
                action: "connect_sepay",
                title: noAccountTitleOf(order.orderNo, given.locale),
                payload: { orderId: given.orderId },
            })
            return { status: "no_account", ...NOT_SENT }
        }
        const text = paymentMessageOf(instruction, { amountVnd, lines: order.items }, content, given.locale)
        await context.effect(
            "channel.send",
            { conversationId: given.conversationId, text },
            { dedupeKey: `payment-request:${given.orderId}` },
        )
        return { status: "sent", content, qrUrl: instruction.qrUrl }
    },
    examples: [
        {
            name: "sends the order number as the transfer content with the account and QR link the provider tool gave",
            params: {},
            input: { orderId: "o1", conversationId: "conv-1", locale: "en" },
            output: { status: "sent", content: "DH202611050001", qrUrl: "https://qr.example/DH202611050001" },
            effects: [
                {
                    kind: "channel.send",
                    payload: {
                        conversationId: "conv-1",
                        text: [
                            "Your order is confirmed: 2 x tea boxes · 300,000 VND.",
                            "Please transfer with these details:",
                            "Bank: MB Bank",
                            "Account number: 525209999",
                            "Account holder: NGUYEN VAN A",
                            "Transfer content (type exactly): DH202611050001",
                            "Or scan the QR code: https://qr.example/DH202611050001",
                            "Once you have transferred, just message us here.",
                        ].join("\n"),
                    },
                },
            ],
            tools: [
                {
                    bankName: "MB Bank",
                    bankCode: "MBBank",
                    accountNumber: "525209999",
                    accountHolder: "NGUYEN VAN A",
                    qrUrl: "https://qr.example/DH202611050001",
                    provider: "sepay",
                },
            ],
            store: {
                order: [
                    {
                        id: "o1",
                        orderNo: "DH-20261105-0001",
                        amountVnd: 300_000,
                        status: "confirmed",
                        items: [{ name: "tea boxes", qty: 2 }],
                    },
                ],
            },
        },
        {
            name: "sends nothing for an order that is not confirmed",
            params: {},
            input: { orderId: "o1", conversationId: "conv-1", locale: "en" },
            output: { status: "not_payable", content: null, qrUrl: null },
            effects: [],
            store: { order: [{ id: "o1", orderNo: "DH-1", amountVnd: 300_000, status: "draft", items: [] }] },
        },
        {
            name: "sends nothing for a confirmed order that has no amount",
            params: {},
            input: { orderId: "o1", conversationId: "conv-1", locale: "en" },
            output: { status: "not_payable", content: null, qrUrl: null },
            effects: [],
            store: { order: [{ id: "o1", orderNo: "DH-1", amountVnd: null, status: "confirmed", items: [] }] },
        },
        {
            name: "sends nothing for an order that is gone",
            params: {},
            input: { orderId: "o9", conversationId: "conv-1", locale: "en" },
            output: { status: "not_payable", content: null, qrUrl: null },
            effects: [],
        },
    ],
})
