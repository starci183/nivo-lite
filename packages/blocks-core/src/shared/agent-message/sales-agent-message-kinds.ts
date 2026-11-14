import { z } from "zod"
import { defineAgentMessageKind, type AgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"

const T = 500

/** The most credits one paid card lists (an order paid in parts is a few transfers). */
const MAX_CREDITS = 20

/** One ordered item as the notice draws it: its name, how many, the price of one and of the line, in words, and the photo of the catalogue item. */
export interface OrderSummaryLine {
    /** The item name. */
    readonly name: string
    /** How many. */
    readonly qty: number
    /** The price of one with its currency, or none while the order has no price for it. */
    readonly unitText?: string | undefined
    /** What the line comes to with its currency, or none. */
    readonly amountText?: string | undefined
    /** The photo of the catalogue item, or none (an item the catalogue lacks, or an older message): the card draws a neutral tile. */
    readonly imageUrl?: string | null | undefined
}

/** The summary of an order the agent tells the owner about. */
export interface OrderSummaryPayload {
    /** The order number. */
    readonly orderNo: string
    /** One entry per ordered item. */
    readonly lines: ReadonlyArray<OrderSummaryLine>
    /** The total with its currency. */
    readonly amountText: string
    /** The customer, or empty. */
    readonly customer: string
    /** Where to deliver, or empty. */
    readonly address: string
}

/** The money that paid an order; it may carry the order's items, customer and delivery, so the card reads as the order does. */
export interface PaymentReceivedPayload {
    /** The order number. */
    readonly orderNo: string
    /** The amount that was received, with its currency: the TOTAL of the order's credits when it was paid in several. */
    readonly amountText: string
    /** Each credit that paid the order, with its currency, oldest first; present only when there were several. */
    readonly credits?: ReadonlyArray<string> | undefined
    /** The items of the order that was paid. */
    readonly lines?: ReadonlyArray<OrderSummaryLine> | undefined
    /** The customer, when known. */
    readonly customer?: string | undefined
    /** Where to deliver, when known. */
    readonly address?: string | undefined
}

const lineSchema: z.ZodType<OrderSummaryLine> = z.object({
    name: z.string().max(T),
    qty: z.number(),
    unitText: z.string().max(T).optional(),
    amountText: z.string().max(T).optional(),
    imageUrl: z.string().max(2000).nullable().optional(),
})

/** The summary of an order the agent tells the owner about: number, lines with photo and price, total, customer and where to deliver. Read only. */
export const orderSummaryKind: AgentMessageKind<z.ZodType<OrderSummaryPayload>> = defineAgentMessageKind({
    id: "order.summary",
    payload: z.object({
        orderNo: z.string().max(T),
        lines: z.array(lineSchema).max(50),
        amountText: z.string().max(T),
        customer: z.string().max(T),
        address: z.string().max(T),
    }),
    actions: { approve: false, edit: "none", reject: false },
})

/** The money that paid an order: the order number and the amount, and the order's items, customer and delivery when known. Read only. */
export const paymentReceivedKind: AgentMessageKind<z.ZodType<PaymentReceivedPayload>> = defineAgentMessageKind({
    id: "payment.received",
    payload: z.object({
        orderNo: z.string().max(T),
        amountText: z.string().max(T),
        credits: z.array(z.string().max(T)).max(MAX_CREDITS).optional(),
        lines: z.array(lineSchema).max(50).optional(),
        customer: z.string().max(T).optional(),
        address: z.string().max(T).optional(),
    }),
    actions: { approve: false, edit: "none", reject: false },
})

/** The kinds the sales and payment flows register. */
export const salesAgentMessageKinds: ReadonlyArray<AgentMessageKind> = [orderSummaryKind, paymentReceivedKind]
