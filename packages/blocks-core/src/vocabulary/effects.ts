import { defineEffect } from "@nivo-lite/agent-sdk/node"
import type { EffectDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ENTRIES, MAX_ID, MAX_LINE } from "../bounds"
import { boundedRecord } from "../json.schema"
import { chatMessageProposeEffect } from "../nodes/chatbot/propose.effect"

/** A message to a customer conversation, through the channel it came from. */
export interface ChannelSendPayload {
    /** The conversation the message goes to. */
    readonly conversationId: string
    /** The words of the message. */
    readonly text: string
    /** Files sent with the message. */
    readonly attachments?: ReadonlyArray<{ readonly url: string; readonly name: string }> | undefined
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

/** One line of an order. */
export interface OrderLine {
    /** What the customer ordered, as the catalogue names it. */
    readonly name: string
    /** How many of it. */
    readonly qty: number
    /** The price of one, in VND, when the catalogue has one. */
    readonly unitPriceVnd?: number | undefined
    /** The catalogue item the line resolved to. */
    readonly catalogueItemId?: string | undefined
}

/** A new order for a customer. */
export interface OrderRecordPayload {
    /** The customer the order is for. */
    readonly leadId: string
    /** What the order holds. */
    readonly items: ReadonlyArray<OrderLine>
    /** The total in VND, or null while a price is missing. */
    readonly amountVnd: number | null
    /** What the customer asked for besides the items. */
    readonly note?: string | undefined
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

/** An order a bank credit paid, with the evidence that matched them. */
export interface PaymentMarkPaidPayload {
    /** The order that was paid. */
    readonly orderId: string
    /** The bank credit that paid it. */
    readonly transactionId: string
    /** Why the credit and the order match. */
    readonly evidence: ReadonlyArray<string>
}

/** What a customer said they paid. */
export interface PaymentClaimRecordPayload {
    /** The customer, or null while the conversation has no lead yet: the claim then belongs to the conversation. */
    readonly leadId: string | null
    /** The conversation the claim came in on. */
    readonly conversationId: string
    /** The amount the customer named, when they named one. */
    readonly amountVnd?: number | undefined
    /** The names the customer gave as the sender. */
    readonly names: ReadonlyArray<string>
    /** The words of the claim. */
    readonly body: string
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

/** A piece of work raised for a person or the gate. */
export interface WorkItemRaisePayload {
    /** The action the work item asks for. */
    readonly action: string
    /** What the person sees. */
    readonly title: string
    /** The data the action runs with. */
    readonly payload: Readonly<Record<string, unknown>>
    /** The amount at stake in VND. */
    readonly amountVnd?: number | undefined
    /** The claim of a customer's word this work settles or escalates, when it is about one. */
    readonly claimId?: string | undefined
}

/** What every undo effect is given: the id of the subject the effect it undoes touched. */
export interface UndoPayload {
    /** The id of the subject to undo. */
    readonly id: string
}

const id = z.string().min(1).max(MAX_ID)
const line = z.string().min(1).max(MAX_LINE)
const body = z.string().min(1).max(MAX_BODY)

const undoPayload: z.ZodType<UndoPayload> = z.object({ id })

const channelSendPayload: z.ZodType<ChannelSendPayload> = z.object({
    conversationId: id,
    text: body,
    attachments: z
        .array(z.object({ url: z.string().max(MAX_BODY), name: z.string().max(MAX_LINE) }))
        .max(MAX_ENTRIES)
        .optional(),
})

const orderRecordPayload: z.ZodType<OrderRecordPayload> = z.object({
    leadId: id,
    items: z
        .array(
            z.object({
                name: line,
                qty: z.number().positive(),
                unitPriceVnd: z.number().nonnegative().optional(),
                catalogueItemId: id.optional(),
            }),
        )
        .min(1)
        .max(MAX_ENTRIES),
    amountVnd: z.number().nonnegative().nullable(),
    note: z.string().max(MAX_BODY).optional(),
})

const leadEnsurePayload: z.ZodType<LeadEnsurePayload> = z.object({
    conversationId: id,
    name: z.string().min(1).max(MAX_LINE).optional(),
    phone: z.string().min(1).max(MAX_LINE).optional(),
    channel: id,
})

const orderConfirmPayload: z.ZodType<OrderConfirmPayload> = z.object({ orderId: id })

const paymentMarkPaidPayload: z.ZodType<PaymentMarkPaidPayload> = z.object({
    orderId: id,
    transactionId: id,
    evidence: z.array(z.string().max(MAX_BODY)).max(MAX_ENTRIES),
})

const paymentRematchPayload: z.ZodType<PaymentRematchPayload> = z.object({ orderId: id })

const paymentClaimRecordPayload: z.ZodType<PaymentClaimRecordPayload> = z.object({
    leadId: id.nullable(),
    conversationId: id,
    amountVnd: z.number().positive().optional(),
    names: z.array(z.string().max(MAX_LINE)).max(MAX_ENTRIES),
    body,
})

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

const workItemRaisePayload: z.ZodType<WorkItemRaisePayload> = z.object({
    action: id,
    title: line,
    payload: boundedRecord,
    amountVnd: z.number().nonnegative().optional(),
    claimId: id.optional(),
})

/** Sends a message to a customer conversation; the subject is the message. */
export const channelSendEffect: EffectDefinition<z.ZodType<ChannelSendPayload>> = defineEffect({
    id: "channel.send",
    title: { key: "effectChannelSend" },
    payload: channelSendPayload,
    rights: [{ kind: "message", access: "write", scope: "turn", fields: ["body"] }],
})

/**
 * Finds the customer of a conversation or creates one and ties it to the conversation; the subject is the customer. A pivot: a
 * customer other records may already point at cannot be cleanly taken back, so it has no undo.
 */
export const leadEnsureEffect: EffectDefinition<z.ZodType<LeadEnsurePayload>> = defineEffect({
    id: "lead.ensure",
    title: { key: "effectLeadEnsure" },
    payload: leadEnsurePayload,
    rights: [{ kind: "sales-lead", access: "write", scope: "turn", fields: ["contactName", "phone", "channel"] }],
})

/** Records an order; the subject is the order. */
export const orderRecordEffect: EffectDefinition<z.ZodType<OrderRecordPayload>> = defineEffect({
    id: "order.record",
    title: { key: "effectOrderRecord" },
    payload: orderRecordPayload,
    rights: [{ kind: "order", access: "write", scope: "turn", fields: ["leadId", "items", "amountVnd"] }],
    compensation: "order.void",
})

/** Voids an order a failed run recorded; voiding it twice is voiding it once. */
export const orderVoidEffect: EffectDefinition<z.ZodType<UndoPayload>> = defineEffect({
    id: "order.void",
    title: { key: "effectOrderVoid" },
    payload: undoPayload,
    rights: [{ kind: "order", access: "write", scope: "turn", fields: ["status"] }],
})

/** Confirms an order; the subject is the order. A pivot: the confirmation is announced to other contexts and cannot be taken back. */
export const orderConfirmEffect: EffectDefinition<z.ZodType<OrderConfirmPayload>> = defineEffect({
    id: "order.confirm",
    title: { key: "effectOrderConfirm" },
    payload: orderConfirmPayload,
    rights: [{ kind: "order", access: "write", scope: "turn", fields: ["status"] }],
})

/** Marks an order paid by a bank credit; the subject is the order. */
export const paymentMarkPaidEffect: EffectDefinition<z.ZodType<PaymentMarkPaidPayload>> = defineEffect({
    id: "payment.mark-paid",
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
    id: "payment.rematch",
    title: { key: "effectPaymentRematch" },
    payload: paymentRematchPayload,
    rights: [],
})

/** Records what a customer said they paid; the subject is the claim. */
export const paymentClaimRecordEffect: EffectDefinition<z.ZodType<PaymentClaimRecordPayload>> = defineEffect({
    id: "payment-claim.record",
    title: { key: "effectPaymentClaimRecord" },
    payload: paymentClaimRecordPayload,
    rights: [
        { kind: "payment-claim", access: "write", scope: "turn", fields: ["leadId", "amountVnd", "names", "body"] },
    ],
    compensation: "payment-claim.withdraw",
})

/** Withdraws a claim a failed run recorded; idempotent. */
export const paymentClaimWithdrawEffect: EffectDefinition<z.ZodType<UndoPayload>> = defineEffect({
    id: "payment-claim.withdraw",
    title: { key: "effectPaymentClaimWithdraw" },
    payload: undoPayload,
    rights: [{ kind: "payment-claim", access: "write", scope: "turn", fields: ["status"] }],
})

/** Tags another agent, which its tag grants allow; the subject is the tag. */
export const agentTagEffect: EffectDefinition<z.ZodType<AgentTagPayload>> = defineEffect({
    id: "agent.tag",
    title: { key: "effectAgentTag" },
    payload: agentTagPayload,
    rights: [],
})

/** Raises a work item for a person or the gate; the subject is the work item. */
export const workItemRaiseEffect: EffectDefinition<z.ZodType<WorkItemRaisePayload>> = defineEffect({
    id: "work-item.raise",
    title: { key: "effectWorkItemRaise" },
    payload: workItemRaisePayload,
    rights: [],
    compensation: "work-item.withdraw",
})

/** Withdraws a work item a failed run raised; idempotent. */
export const workItemWithdrawEffect: EffectDefinition<z.ZodType<UndoPayload>> = defineEffect({
    id: "work-item.withdraw",
    title: { key: "effectWorkItemWithdraw" },
    payload: undoPayload,
    rights: [],
})

/** Every effect the core nodes may run and every undo a compensation runs; the back end registers an executor for each. */
export const coreEffects: ReadonlyArray<EffectDefinition> = [
    channelSendEffect,
    chatMessageProposeEffect,
    leadEnsureEffect,
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
]
