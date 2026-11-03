import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { OrderLine, PaymentAccount } from "./payment-request.policy"
import { isPayableAccount, noAccountTitleOf, paymentRequestOf } from "./payment-request.policy"
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
    /** `sent`: the message went to the customer; `no_account`: no SePay account, the owner was told; `not_payable`: the order is not confirmed or has no amount. */
    readonly status: "sent" | "no_account" | "not_payable"
    /** The transfer content, or null when nothing was sent. */
    readonly content: string | null
    /** The VietQR link, or null when nothing was sent. */
    readonly qrUrl: string | null
}

/** The order as the order data port reads it. */
interface PayableOrder {
    readonly orderNo: string
    readonly amountVnd: number | null
    readonly status: string
    readonly items: ReadonlyArray<OrderLine>
}

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

/**
 * `payment.request`: asks the customer to pay a confirmed order: the amount, the order number as the transfer content, the SePay
 * account and the VietQR link, sent on the channel of the conversation. Without a SePay account nothing is sent and the owner gets a
 * work item. The host makes the send once per run and step.
 */
export const paymentRequestNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "payment.request",
    role: "output",
    title: { vi: "Gửi yêu cầu thanh toán", en: "Send the payment request" },
    params,
    input,
    output,
    rights: [
        {
            kind: "payment-account",
            access: "read",
            scope: "workspace",
            fields: ["provider", "bankCode", "bankName", "accountNumber", "accountHolder"],
        },
        { kind: "order", access: "read", scope: "turn", fields: ["id", "orderNo", "amountVnd", "status", "items"] },
    ],
    effects: ["channel.send", "work-item.raise"],
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
        const [account] = await context.data.read<PaymentAccount>("payment-account", {
            fields: ["provider", "bankCode", "bankName", "accountNumber", "accountHolder"],
            limit: 1,
        })
        const subject = { kind: "order", id: given.orderId }
        if (!isPayableAccount(account)) {
            await context.effect("work-item.raise", subject, {
                action: "connect_sepay",
                title: noAccountTitleOf(order.orderNo, given.locale),
                payload: { orderId: given.orderId },
            })
            return { status: "no_account", ...NOT_SENT }
        }
        const request = paymentRequestOf(
            account,
            { orderNo: order.orderNo, amountVnd, lines: order.items },
            given.locale,
        )
        await context.effect(
            "channel.send",
            { kind: "message", id: given.conversationId },
            { conversationId: given.conversationId, text: request.message },
        )
        return { status: "sent", content: request.content, qrUrl: request.qrUrl }
    },
    examples: [
        {
            name: "sends the transfer content, the SePay account and the VietQR link on the conversation",
            params: {},
            input: { orderId: "o1", conversationId: "conv-1", locale: "en" },
            output: {
                status: "sent",
                content: "DH202611050001",
                qrUrl: "https://qr.sepay.vn/img?acc=525209999&bank=MBBank&amount=300000&des=DH202611050001&template=compact",
            },
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
                            "Or scan the QR code: https://qr.sepay.vn/img?acc=525209999&bank=MBBank&amount=300000&des=DH202611050001&template=compact",
                            "Once you have transferred, just message us here.",
                        ].join("\n"),
                    },
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
                "payment-account": [
                    {
                        provider: "sepay",
                        bankCode: "MBBank",
                        bankName: "MB Bank",
                        accountNumber: "525209999",
                        accountHolder: "NGUYEN VAN A",
                    },
                ],
            },
        },
        {
            name: "writes the Vietnamese message from the bank code when the feed has no bank name or holder",
            params: {},
            input: { orderId: "o1", conversationId: "conv-1", locale: "vi" },
            output: {
                status: "sent",
                content: "DH1",
                qrUrl: "https://qr.sepay.vn/img?acc=525209999&bank=MBBank&amount=1500000&des=DH1&template=compact",
            },
            effects: [
                {
                    kind: "channel.send",
                    payload: {
                        conversationId: "conv-1",
                        text: [
                            "Đơn của bạn đã được xác nhận: — · 1.500.000 đ.",
                            "Bạn vui lòng chuyển khoản theo thông tin sau:",
                            "Ngân hàng: MBBank",
                            "Số tài khoản: 525209999",
                            "Nội dung chuyển khoản (ghi đúng): DH1",
                            "Hoặc quét mã QR: https://qr.sepay.vn/img?acc=525209999&bank=MBBank&amount=1500000&des=DH1&template=compact",
                            "Chuyển khoản xong bạn nhắn lại cho shop nhé.",
                        ].join("\n"),
                    },
                },
            ],
            store: {
                order: [{ id: "o1", orderNo: "DH-1", amountVnd: 1_500_000, status: "confirmed", items: [] }],
                "payment-account": [
                    {
                        provider: "sepay",
                        bankCode: "MBBank",
                        bankName: null,
                        accountNumber: "525209999",
                        accountHolder: null,
                    },
                ],
            },
        },
        {
            name: "raises a work item for the owner and sends nothing without a SePay account",
            params: {},
            input: { orderId: "o1", conversationId: "conv-1", locale: "en" },
            output: { status: "no_account", content: null, qrUrl: null },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "connect_sepay",
                        title: "Order DH-1 has no payment request: no SePay connection with a full account number",
                        payload: { orderId: "o1" },
                    },
                },
            ],
            store: {
                order: [{ id: "o1", orderNo: "DH-1", amountVnd: 300_000, status: "confirmed", items: [] }],
                "payment-account": [
                    {
                        provider: "casso",
                        bankCode: "VCB",
                        bankName: null,
                        accountNumber: "1234567",
                        accountHolder: null,
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
            store: {
                order: [{ id: "o1", orderNo: "DH-1", amountVnd: 300_000, status: "draft", items: [] }],
            },
        },
        {
            name: "sends nothing for a confirmed order that has no amount",
            params: {},
            input: { orderId: "o1", conversationId: "conv-1", locale: "en" },
            output: { status: "not_payable", content: null, qrUrl: null },
            effects: [],
            store: {
                order: [{ id: "o1", orderNo: "DH-1", amountVnd: null, status: "confirmed", items: [] }],
            },
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
