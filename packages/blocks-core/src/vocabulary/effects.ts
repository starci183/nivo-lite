import { defineEffect } from "@nivo-lite/agent-sdk/node"
import type { EffectDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"

/** A message to a customer conversation, through the channel it came from. */
export interface ChannelSendPayload {
    readonly conversationId: string
    readonly text: string
    readonly attachments?: ReadonlyArray<{ readonly url: string; readonly name: string }> | undefined
}

/** One line of an order. */
export interface OrderLine {
    readonly name: string
    readonly qty: number
    readonly unitPriceVnd?: number | undefined
    readonly catalogueItemId?: string | undefined
}

/** A new order for a customer. */
export interface OrderRecordPayload {
    readonly leadId: string
    readonly items: ReadonlyArray<OrderLine>
    readonly amountVnd: number | null
    readonly note?: string | undefined
}

/** An order to confirm. */
export interface OrderConfirmPayload {
    readonly orderId: string
}

/** An order a bank credit paid, with the evidence that matched them. */
export interface PaymentMarkPaidPayload {
    readonly orderId: string
    readonly transactionId: string
    readonly evidence: ReadonlyArray<string>
}

/** What a customer said they paid. */
export interface PaymentClaimRecordPayload {
    /** The customer, or null while the conversation has no lead yet: the claim then belongs to the conversation. */
    readonly leadId: string | null
    readonly conversationId: string
    readonly amountVnd?: number | undefined
    readonly names: ReadonlyArray<string>
    readonly body: string
}

/** A tag of another agent: by id, or by the module whose agent the workspace runs. */
export interface AgentTagPayload {
    readonly toAgentId?: string | undefined
    readonly toModuleKey?: string | undefined
    readonly text: string
    readonly conversationId?: string | undefined
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
    readonly action: string
    readonly title: string
    readonly payload: Readonly<Record<string, unknown>>
    readonly amountVnd?: number | undefined
    /** The claim of a customer's word this work settles or escalates, when it is about one. */
    readonly claimId?: string | undefined
}

/** What every undo effect is given: the id of the subject the effect it undoes touched. */
export interface UndoPayload {
    readonly id: string
}

const id = z.string().min(1)

const undoPayload: z.ZodType<UndoPayload> = z.object({ id })

const channelSendPayload: z.ZodType<ChannelSendPayload> = z.object({
    conversationId: id,
    text: z.string().min(1),
    attachments: z.array(z.object({ url: z.string(), name: z.string() })).optional(),
})

const orderRecordPayload: z.ZodType<OrderRecordPayload> = z.object({
    leadId: id,
    items: z
        .array(
            z.object({
                name: z.string().min(1),
                qty: z.number().positive(),
                unitPriceVnd: z.number().nonnegative().optional(),
                catalogueItemId: id.optional(),
            }),
        )
        .min(1),
    amountVnd: z.number().nonnegative().nullable(),
    note: z.string().optional(),
})

const orderConfirmPayload: z.ZodType<OrderConfirmPayload> = z.object({ orderId: id })

const paymentMarkPaidPayload: z.ZodType<PaymentMarkPaidPayload> = z.object({
    orderId: id,
    transactionId: id,
    evidence: z.array(z.string()),
})

const paymentClaimRecordPayload: z.ZodType<PaymentClaimRecordPayload> = z.object({
    leadId: id.nullable(),
    conversationId: id,
    amountVnd: z.number().positive().optional(),
    names: z.array(z.string()),
    body: z.string().min(1),
})

const agentTagPayload: z.ZodType<AgentTagPayload> = z
    .object({
        toAgentId: id.optional(),
        toModuleKey: id.optional(),
        text: z.string().min(1),
        conversationId: id.optional(),
        subject: z.object({ kind: id, id }).optional(),
        leadId: id.optional(),
        channel: id.optional(),
        context: z.record(z.string(), z.unknown()).optional(),
        visibility: z.enum(["chat", "redirect"]).optional(),
    })
    .refine((payload) => (payload.toAgentId === undefined) !== (payload.toModuleKey === undefined))

const workItemRaisePayload: z.ZodType<WorkItemRaisePayload> = z.object({
    action: id,
    title: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
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

/** Records what a customer said they paid; the subject is the claim. */
export const paymentClaimRecordEffect: EffectDefinition<z.ZodType<PaymentClaimRecordPayload>> = defineEffect({
    id: "payment-claim.record",
    title: { key: "effectPaymentClaimRecord" },
    payload: paymentClaimRecordPayload,
    rights: [{ kind: "payment-claim", access: "write", scope: "turn", fields: ["leadId", "amountVnd", "names", "body"] }],
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
    orderRecordEffect,
    orderVoidEffect,
    orderConfirmEffect,
    paymentMarkPaidEffect,
    paymentClaimRecordEffect,
    paymentClaimWithdrawEffect,
    agentTagEffect,
    workItemRaiseEffect,
    workItemWithdrawEffect,
] as ReadonlyArray<EffectDefinition>
