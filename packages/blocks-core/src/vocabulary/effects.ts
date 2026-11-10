import { defineEffect } from "@nivo-lite/agent-sdk/node"
import type { EffectDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ENTRIES, MAX_ID, MAX_LINE } from "../bounds"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { CONSULT_STAGES } from "../entities/sales/lead.entity"
import { LEAD_STAGES } from "../rules/sales/stage"
import type { LeadStage } from "../rules/sales/stage"
import { boundedRecord } from "../json.schema"
import { careScheduleEffect } from "./care-effects"
import { TOOL } from "./tool-ids"

/** A message to a customer conversation, through the channel it came from. */
interface ChannelSendCommon {
    /** The words of the message. */
    readonly text: string
    /** The order the message is about: the stored message draws its card from the order record. */
    readonly orderId?: string | undefined
    /** Catalogue items to show as pictures, at most ten: each goes with the catalogue's own name and price. */
    readonly catalogueItemIds?: ReadonlyArray<string> | undefined
}

/** A message to a customer: in the conversation named, or to the customer named, on their channel (the one named when they have several). */
export type ChannelSendPayload =
    | (ChannelSendCommon & {
          /** The conversation the message goes to. */
          readonly conversationId: string
      })
    | (ChannelSendCommon & {
          /** The customer the message goes to, in their conversation. */
          readonly leadId: string
          /** The channel to use when the customer has more than one. */
          readonly channel?: string | undefined
      })

/** What a node changes on a customer: the stage of the sales consult and what it found out so far; a member left out is kept. */
export interface LeadUpdatePayload {
    /** The customer. */
    readonly leadId: string
    /** The stage the consult moved to. */
    readonly consultStage?: string | undefined
    /** What the consult found out: who it is for, the occasion, the budget, the time, the address, the products shown and picked. */
    readonly consultFacts?: { readonly [key: string]: JsonValue } | undefined
}

/** A customer's deal moved to a stage of the pipeline. */
export interface LeadStageUpdatePayload {
    /** The customer. */
    readonly leadId: string
    /** The stage of the pipeline the deal moves to. */
    readonly stage: LeadStage
}

/** The customer of a conversation: found, or created from what the chat knows. */
export interface LeadEnsurePayload {
    /** The conversation whose customer is wanted. */
    readonly conversationId: string
    /** The name the customer gave, when known. */
    readonly name?: string | undefined
    /** The phone the customer gave, when known. */
    readonly phone?: string | undefined
    /** The channel the conversation runs on. */
    readonly channel: string
}

/** One thing a customer orders: which catalogue item and how many. The price is the catalogue's, never the caller's. */
export interface OrderLine {
    /** The catalogue item, when its id is known. */
    readonly catalogueItemId?: string | undefined
    /** The item as the customer named it, used to find the catalogue item when no id is given. */
    readonly name?: string | undefined
    /** How many of it. */
    readonly qty: number
}

/** A new order for a customer: what and how many, and where it goes. Prices and the total come from the catalogue. */
export interface OrderRecordPayload {
    /** The customer the order is for. */
    readonly leadId: string
    /** What the order holds. */
    readonly items: ReadonlyArray<OrderLine>
    /** Where to deliver, in the customer's words. */
    readonly address?: string | undefined
    /** The name of the person who receives the delivery, when it is not the customer. */
    readonly recipientName?: string | undefined
    /** The phone number of the person who receives the delivery, as the customer gave it. */
    readonly recipientPhone?: string | undefined
    /** The day and time window of the delivery, in the customer's words. */
    readonly deliveryAt?: string | undefined
    /** What the customer asked for besides the items. */
    readonly note?: string | undefined
    /** A draft order of this customer to rewrite instead of making a second one. */
    readonly orderId?: string | undefined
}

/** An order to confirm. */
export interface OrderConfirmPayload {
    /** The order to confirm. */
    readonly orderId: string
}

/** An order that was just given a payment code, for which an earlier credit is looked for. */
export interface PaymentRematchPayload {
    /** The order the code was issued for. */
    readonly orderId: string
}

/** An order and the bank credit that paid it, and optionally the customer's claim this settles. */
export interface PaymentMarkPaidPayload {
    /** The order that was paid. */
    readonly orderId: string
    /** The bank credit that paid it. */
    readonly transactionId: string
    /** The customer's payment claim this answers; left out, the claims linked to the order are closed. */
    readonly claimId?: string | undefined
}

/** What a customer said they paid. */
export interface PaymentClaimRecordPayload {
    /** The customer, or null while the conversation has no lead yet: the claim then belongs to the conversation. */
    readonly leadId: string | null
    /** The conversation the claim came in on. */
    readonly conversationId: string
    /** The amount the customer wrote, when they wrote one. */
    readonly amountVnd?: number | undefined
    /** The names the customer gave as the sender. */
    readonly names: ReadonlyArray<string>
    /** The words of the claim. */
    readonly body: string
    /** The order the claim is about, when the agent decided which; the answer lists the customer's orders awaiting payment. */
    readonly orderId?: string | undefined
}

/** A tag of another agent: by id, or by the module whose agent the workspace runs. */
export interface AgentTagPayload {
    /** The agent to tag. */
    readonly toAgentId?: string | undefined
    /** The module whose agent to tag. */
    readonly toModuleKey?: string | undefined
    /** What the tag says. */
    readonly text: string
    /** The conversation the tag is about. */
    readonly conversationId?: string | undefined
    /** The record the tag is about. */
    readonly subject?: { readonly kind: string; readonly id: string } | undefined
    /** The customer the tag is about, which the target's turn is scoped to. */
    readonly leadId?: string | undefined
    /** The channel the conversation runs on. */
    readonly channel?: string | undefined
    /** Plain data for the target's graph, which reads it as `trigger.context`. */
    readonly context?: Readonly<Record<string, unknown>> | undefined
    /** How the customer sees the hand-over: in the same chat (the default), or redirected to the tagged agent. */
    readonly visibility?: "chat" | "redirect" | undefined
}

/** A piece of work raised for a person or the gate. The amount at stake is read from the order or the bank credit the data names. */
export interface WorkItemRaisePayload {
    /** The action the work item asks for. */
    readonly action: string
    /** What the person sees. */
    readonly title: string
    /** The data the action runs with: ids (`orderId`, `transactionId`, `leadId`, `conversationId`) and short words. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The claim of a customer's word this work settles or escalates, when it is about one. */
    readonly claimId?: string | undefined
}

/** Who in the team a message is for: the founder alone, the room of the agent's own module, or the room of the whole shop. */
export type TeamAudience = "own" | "everyone" | "founder"

/** The card of an order, built from the order record. */
export interface TeamOrderSummary {
    /** The card kind. */
    readonly kind: "order.summary"
    /** The order to show. */
    readonly orderId: string
    /** Who reads it; the founder when absent. */
    readonly audience?: TeamAudience | undefined
}

/** The card of the money that paid an order, built from the order and the bank credit that paid it. */
export interface TeamPaymentReceived {
    /** The card kind. */
    readonly kind: "payment.received"
    /** The order that was paid. */
    readonly orderId: string
    /** Who reads it; the founder when absent. */
    readonly audience?: TeamAudience | undefined
}

/** Plain words to the team. */
export interface TeamText {
    /** The card kind. */
    readonly kind: "message.text"
    /** What the message is for: tell, ask, or report. */
    readonly intent: "notify" | "ask" | "report"
    /** The heading. */
    readonly title: string
    /** The words. */
    readonly text: string
    /** Who reads it; the founder when absent. */
    readonly audience?: TeamAudience | undefined
}

/** What an agent says to the team in the chat: a card built from a record by its id, or plain words. */
export type AgentMessagePostPayload = TeamOrderSummary | TeamPaymentReceived | TeamText

/** What every undo effect is given: the id of the subject the effect it undoes touched. */
export interface UndoPayload {
    /** The id of the subject to undo. */
    readonly id: string
}

/** The most catalogue pictures one message carries: one Telegram album holds ten. */
const CATALOGUE_PICTURES_MAX = 10

/** The most lines one order holds. */
const ORDER_LINES_MAX = 100

/** The longest plain message to the team. */
const TEAM_TEXT_MAX = 4000

const id = z.string().min(1).max(MAX_ID)
const line = z.string().min(1).max(MAX_LINE)
const body = z.string().min(1).max(MAX_BODY)

const undoPayload: z.ZodType<UndoPayload> = z.object({ id })

const channelSendCommon = {
    text: body.describe("The words to send, in the customer's language. Never write a price or a total you did not read from a tool."),
    orderId: id
        .optional()
        .describe("The order this message is about; the message then shows that order's card. Do not type its lines or prices."),
    catalogueItemIds: z
        .array(id)
        .max(CATALOGUE_PICTURES_MAX)
        .optional()
        .describe("Catalogue items to show as pictures (at most 10); each is sent with the catalogue's own name and price."),
}

const channelSendPayload: z.ZodType<ChannelSendPayload> = z
    .union([
        z.object({ conversationId: id.describe("The customer conversation to speak in."), ...channelSendCommon }),
        z.object({
            leadId: id.describe("The customer to speak to, in their conversation."),
            channel: id.optional().describe("The channel to use when the customer has more than one (zalo, telegram, meta)."),
            ...channelSendCommon,
        }),
    ])
    .describe(
        "Send one message to a customer in their conversation, on the channel it came in on. Refused when a person of the shop holds the conversation or the channel cannot deliver.",
    )

const orderRecordPayload: z.ZodType<OrderRecordPayload> = z
    .object({
        leadId: id.describe("The customer the order is for."),
        items: z
            .array(
                z
                    .object({
                        catalogueItemId: id.optional().describe("The id of the catalogue item, when you know it."),
                        name: line
                            .optional()
                            .describe(
                                "The item as the customer named it; used to find the catalogue item when no id is given.",
                            ),
                        qty: z.number().positive().describe("How many."),
                    })
                    .refine((item) => item.catalogueItemId !== undefined || item.name !== undefined),
            )
            .min(1)
            .max(ORDER_LINES_MAX)
            .describe("What the customer orders. Give no price: prices and the total come from the catalogue."),
        address: z.string().max(MAX_LINE).optional().describe("Where to deliver, in the customer's words."),
        recipientName: z
            .string()
            .max(MAX_LINE)
            .optional()
            .describe("The name of the person who receives the delivery, when the customer named one."),
        recipientPhone: z
            .string()
            .max(MAX_LINE)
            .optional()
            .describe("The phone number of the person who receives the delivery, as the customer gave it."),
        deliveryAt: z
            .string()
            .max(MAX_LINE)
            .optional()
            .describe("The day and time window of the delivery, in the customer's words."),
        note: z
            .string()
            .max(MAX_BODY)
            .optional()
            .describe("What the customer asked for besides the items, the recipient, the address, the phone and the time (a card, a wish)."),
        orderId: id.optional().describe("A draft order of this customer to rewrite instead of creating a second one."),
    })
    .describe(
        "Create the order of a customer as a draft. The tool prices every item from the shop's catalogue and answers the lines, the total and whether the order waits for the owner. It refuses an item the catalogue does not list or has not priced.",
    )

const leadEnsurePayload: z.ZodType<LeadEnsurePayload> = z.object({
    conversationId: id,
    name: z.string().min(1).max(MAX_LINE).optional(),
    phone: z.string().min(1).max(MAX_LINE).optional(),
    channel: id,
})

const orderConfirmPayload: z.ZodType<OrderConfirmPayload> = z
    .object({ orderId: id.describe("The draft order to confirm.") })
    .describe(
        "Confirm a draft order. An order at or above the shop's owner-approval limit is not confirmed: the tool answers that it waits for the owner, with the amount and the limit.",
    )

const leadUpdatePayload: z.ZodType<LeadUpdatePayload> = z.object({
    leadId: id,
    consultStage: z.enum(CONSULT_STAGES).optional(),
    consultFacts: boundedRecord.optional(),
})

const leadStageUpdatePayload: z.ZodType<LeadStageUpdatePayload> = z
    .object({
        leadId: id.describe("The customer whose deal moves."),
        stage: z.enum(LEAD_STAGES).describe("The stage of the pipeline the deal moves to."),
    })
    .describe(
        "Move a customer's deal to a stage of the pipeline. It answers the stage before and after as facts; when to move a deal (on a confirmed order, on payment, never a lost one) is the policy's, not the tool's.",
    )

const paymentMarkPaidPayload: z.ZodType<PaymentMarkPaidPayload> = z
    .object({
        orderId: id.describe("The order that was paid."),
        transactionId: id.describe("The bank credit that paid it."),
        claimId: id
            .optional()
            .describe("The customer's payment claim this answers; leave it out to close the claims linked to the order."),
    })
    .describe(
        "Mark an order paid by a real, unused bank credit. The tool never refuses on the amount: it answers what the order was due, what the credit brought and the difference (negative short, positive over). It refuses only a credit already used or missing, and an order missing, closed or unpriced.",
    )

const paymentRematchPayload: z.ZodType<PaymentRematchPayload> = z.object({ orderId: id })

const paymentClaimRecordPayload: z.ZodType<PaymentClaimRecordPayload> = z
    .object({
        leadId: id.nullable().describe("The customer, or null when the conversation has no customer record yet."),
        conversationId: id.describe("The conversation the customer wrote in."),
        amountVnd: z
            .number()
            .positive()
            .optional()
            .describe(
                "The amount in VND the customer literally wrote; leave it out when they wrote none. Never compute it.",
            ),
        names: z
            .array(z.string().max(MAX_LINE))
            .max(MAX_ENTRIES)
            .describe("The sender names the customer gave for the transfer; empty when none."),
        body: body.describe("The customer's own words saying they paid."),
        orderId: id
            .optional()
            .describe(
                "The order the claim is about, when you decided which; leave it out when unsure. The answer lists the customer's orders awaiting payment (ids and numbers) to choose from.",
            ),
    })
    .describe("Record that a customer says they have paid. It marks nothing paid: only a bank credit does.")

const agentTagPayload: z.ZodType<AgentTagPayload> = z
    .object({
        toAgentId: id.optional(),
        toModuleKey: id.optional(),
        text: body,
        conversationId: id.optional(),
        subject: z.object({ kind: id, id }).optional(),
        leadId: id.optional(),
        channel: id.optional(),
        context: boundedRecord.optional(),
        visibility: z.enum(["chat", "redirect"]).optional(),
    })
    .refine((payload) => (payload.toAgentId === undefined) !== (payload.toModuleKey === undefined))

const workItemRaisePayload: z.ZodType<WorkItemRaisePayload> = z
    .object({
        action: id.describe("The action the person is asked to decide, as the shop's rules name it."),
        title: line.describe("The one line the person reads."),
        payload: boundedRecord.describe(
            "The records the decision is about, by id (orderId, transactionId, leadId, conversationId) and short words. Give no amount: it is read from the order or the bank credit.",
        ),
        claimId: id.optional().describe("The payment claim this is about, when it is about one."),
    })
    .describe(
        "Ask a person of the shop to decide something. The amount at stake is read from the records the data names.",
    )

const audience = z
    .enum(["founder", "own", "everyone"])
    .optional()
    .describe(
        "Every line reaches the owner in your private chat. Audience adds a group: own (also post it in your team's room), everyone (also post it in the whole shop's room), founder (the owner alone). A group only receives it when you hold the right to post there; the answer says where it went.",
    )

const agentMessagePostPayload: z.ZodType<AgentMessagePostPayload> = z
    .discriminatedUnion("kind", [
        z.object({
            kind: z.literal("order.summary"),
            orderId: id.describe("The order to show: the card is built from the order record."),
            audience,
        }),
        z.object({
            kind: z.literal("payment.received"),
            orderId: id.describe("The paid order: the card is built from the order and the bank credit that paid it."),
            audience,
        }),
        z.object({
            kind: z.literal("message.text"),
            intent: z.enum(["notify", "ask", "report"]).describe("What the message is for: tell, ask, or report."),
            title: line.describe("The heading."),
            text: z
                .string()
                .min(1)
                .max(TEAM_TEXT_MAX)
                .describe("The words. Quote an amount only as a tool or the customer gave it."),
            audience,
        }),
    ])
    .describe(
        "Tell the team in the shop's internal chat (never the customer). A card about an order or a payment is built from the record you name by id; use message.text for plain words.",
    )

/** Sends a message to a customer conversation; the subject is the message. */
export const channelSendEffect: EffectDefinition<z.ZodType<ChannelSendPayload>> = defineEffect({
    id: TOOL.customerMessageSend,
    title: { key: "effectChannelSend" },
    payload: channelSendPayload,
    rights: [{ kind: "message", access: "write", scope: "turn", fields: ["body"] }],
})

/**
 * Finds the customer of a conversation or creates one and ties it to the conversation; the subject is the customer. A pivot: a
 * customer other records may already point at cannot be cleanly taken back, so it has no undo.
 */
export const leadEnsureEffect: EffectDefinition<z.ZodType<LeadEnsurePayload>> = defineEffect({
    id: TOOL.leadEnsure,
    title: { key: "effectLeadEnsure" },
    payload: leadEnsurePayload,
    rights: [{ kind: "sales-lead", access: "write", scope: "turn", fields: ["contactName", "phone", "channel"] }],
})

/**
 * Updates a customer: the stage of the sales consult and what it found out; the subject is the customer. The next step of the same consult
 * writes it again, so no undo is kept.
 */
export const leadUpdateEffect: EffectDefinition<z.ZodType<LeadUpdatePayload>> = defineEffect({
    id: TOOL.leadUpdate,
    title: { key: "effectLeadUpdate" },
    payload: leadUpdatePayload,
    rights: [{ kind: "sales-lead", access: "write", scope: "turn", fields: ["consultStage", "consultFacts"] }],
})

/** Moves a customer's deal to a pipeline stage; the subject is the customer, the stage before and after ride as facts. */
export const leadStageUpdateEffect: EffectDefinition<z.ZodType<LeadStageUpdatePayload>> = defineEffect({
    id: TOOL.leadStageUpdate,
    title: { vi: "Chuyển giai đoạn thương vụ", en: "Move the deal's stage" },
    payload: leadStageUpdatePayload,
    rights: [{ kind: "sales-lead", access: "write", scope: "turn", fields: ["stage"] }],
})

/** Records an order; the subject is the order. */
export const orderRecordEffect: EffectDefinition<z.ZodType<OrderRecordPayload>> = defineEffect({
    id: TOOL.orderRecord,
    title: { key: "effectOrderRecord" },
    payload: orderRecordPayload,
    rights: [{ kind: "order", access: "write", scope: "turn", fields: ["leadId", "items", "amountVnd"] }],
    compensation: TOOL.orderVoid,
})

/** Voids an order a failed run recorded; voiding it twice is voiding it once. */
export const orderVoidEffect: EffectDefinition<z.ZodType<UndoPayload>> = defineEffect({
    id: TOOL.orderVoid,
    title: { key: "effectOrderVoid" },
    payload: undoPayload,
    rights: [{ kind: "order", access: "write", scope: "turn", fields: ["status"] }],
})

/** Confirms an order; the subject is the order. A pivot: the confirmation is announced to other contexts and cannot be taken back. */
export const orderConfirmEffect: EffectDefinition<z.ZodType<OrderConfirmPayload>> = defineEffect({
    id: TOOL.orderConfirm,
    title: { key: "effectOrderConfirm" },
    payload: orderConfirmPayload,
    rights: [{ kind: "order", access: "write", scope: "turn", fields: ["status"] }],
})

/** Marks an order paid by a bank credit; the subject is the order. */
export const paymentMarkPaidEffect: EffectDefinition<z.ZodType<PaymentMarkPaidPayload>> = defineEffect({
    id: TOOL.paymentMarkPaid,
    title: { key: "effectPaymentMarkPaid" },
    payload: paymentMarkPaidPayload,
    rights: [
        { kind: "order", access: "write", scope: "workspace", fields: ["status"] },
        { kind: "bank-transaction", access: "write", scope: "workspace", fields: ["orderId"] },
    ],
})

/**
 * Asks the engine to look again for a credit that arrived before the order had a payment code: the back end enqueues the
 * `payment.rematch` job for the order (the settlement itself is the job's, through the same path as an arrival); the subject is the order.
 */
export const paymentRematchEffect: EffectDefinition<z.ZodType<PaymentRematchPayload>> = defineEffect({
    id: TOOL.paymentRematch,
    title: { key: "effectPaymentRematch" },
    payload: paymentRematchPayload,
    rights: [],
})

/** Records what a customer said they paid; the subject is the claim. */
export const paymentClaimRecordEffect: EffectDefinition<z.ZodType<PaymentClaimRecordPayload>> = defineEffect({
    id: TOOL.paymentClaimRecord,
    title: { key: "effectPaymentClaimRecord" },
    payload: paymentClaimRecordPayload,
    rights: [
        { kind: "payment-claim", access: "write", scope: "turn", fields: ["leadId", "amountVnd", "names", "body"] },
    ],
    compensation: TOOL.paymentClaimWithdraw,
})

/** Withdraws a claim a failed run recorded; idempotent. */
export const paymentClaimWithdrawEffect: EffectDefinition<z.ZodType<UndoPayload>> = defineEffect({
    id: TOOL.paymentClaimWithdraw,
    title: { key: "effectPaymentClaimWithdraw" },
    payload: undoPayload,
    rights: [{ kind: "payment-claim", access: "write", scope: "turn", fields: ["status"] }],
})

/** Tags another agent, which its tag grants allow; the subject is the tag. */
export const agentTagEffect: EffectDefinition<z.ZodType<AgentTagPayload>> = defineEffect({
    id: TOOL.agentTag,
    title: { key: "effectAgentTag" },
    payload: agentTagPayload,
    rights: [],
})

/** Raises a work item for a person or the gate; the subject is the work item. */
export const workItemRaiseEffect: EffectDefinition<z.ZodType<WorkItemRaisePayload>> = defineEffect({
    id: TOOL.workItemRaise,
    title: { key: "effectWorkItemRaise" },
    payload: workItemRaisePayload,
    rights: [],
    compensation: TOOL.workItemWithdraw,
})

/**
 * Says something to the owner in the agent's own chat and in the team chat: a message of a registered kind with an intent. Once per
 * dedupe key across runs; the subject is the chat message.
 */
export const agentMessagePostEffect: EffectDefinition<z.ZodType<AgentMessagePostPayload>> = defineEffect({
    id: TOOL.teamMessagePost,
    title: { key: "effectAgentMessagePost" },
    payload: agentMessagePostPayload,
    rights: [],
})

/** Withdraws a work item a failed run raised; idempotent. */
export const workItemWithdrawEffect: EffectDefinition<z.ZodType<UndoPayload>> = defineEffect({
    id: TOOL.workItemWithdraw,
    title: { key: "effectWorkItemWithdraw" },
    payload: undoPayload,
    rights: [],
})

/** A confirmed order whose payment details the customer is sent. */
export interface PaymentQrCreatePayload {
    /** The order to pay. */
    readonly orderId: string
}

/** A day to close. */
export interface ReportDailyClosePayload {
    /** The day, `YYYY-MM-DD` in the shop's time; today when absent. */
    readonly day?: string | undefined
}

const paymentQrCreatePayload: z.ZodType<PaymentQrCreatePayload> = z
    .object({ orderId: id.describe("The confirmed order the customer pays.") })
    .describe(
        "Send the customer of a confirmed order the bank details and the payment QR, in the order's conversation. The amount and the transfer content come from the order; the tool also arms the payment reminders. Refused when the order is not confirmed, has no total, or the shop has no payment account.",
    )

const reportDailyClosePayload: z.ZodType<ReportDailyClosePayload> = z
    .object({
        day: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/u)
            .optional()
            .describe("The day to close, YYYY-MM-DD in the shop's time; today when left out."),
    })
    .describe(
        "Close a day of the books: the tool computes the day's figures from the records, posts the report card to the team and answers the figures. Type no number yourself.",
    )

/**
 * Sends the customer of a confirmed order how to pay it (bank details, QR, the order card), looks for a credit that arrived before the code
 * and arms the payment reminders; the subject is the message. Everything is read from the order: the caller gives its id alone.
 */
export const paymentQrCreateEffect: EffectDefinition<z.ZodType<PaymentQrCreatePayload>> = defineEffect({
    id: TOOL.paymentQrCreate,
    title: { key: "effectPaymentQrCreate" },
    payload: paymentQrCreatePayload,
    rights: [{ kind: "message", access: "write", scope: "turn", fields: ["body"] }],
})

/** Closes a day of the books and posts its report card; the subject is the chat message, the figures ride as facts. */
export const reportDailyCloseEffect: EffectDefinition<z.ZodType<ReportDailyClosePayload>> = defineEffect({
    id: TOOL.reportDailyClose,
    title: { key: "effectReportDailyClose" },
    payload: reportDailyClosePayload,
    rights: [],
})

/** Every effect the core nodes may run and every undo a compensation runs; the back end registers an executor for each. */
export const coreEffects: ReadonlyArray<EffectDefinition> = [
    channelSendEffect,
    leadEnsureEffect,
    leadUpdateEffect,
    leadStageUpdateEffect,
    careScheduleEffect,
    orderRecordEffect,
    orderVoidEffect,
    orderConfirmEffect,
    paymentMarkPaidEffect,
    paymentRematchEffect,
    paymentClaimRecordEffect,
    paymentClaimWithdrawEffect,
    agentTagEffect,
    workItemRaiseEffect,
    workItemWithdrawEffect,
    agentMessagePostEffect,
    paymentQrCreateEffect,
    reportDailyCloseEffect,
]
