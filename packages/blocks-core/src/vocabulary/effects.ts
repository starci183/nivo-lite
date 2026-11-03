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
    readonly leadId: string
    readonly conversationId: string | null
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
}

/** A piece of work raised for a person or the gate. */
export interface WorkItemRaisePayload {
    readonly action: string
    readonly title: string
    readonly payload: Readonly<Record<string, unknown>>
    readonly amountVnd?: number | undefined
}

const id = z.string().min(1)

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
    leadId: id,
    conversationId: id.nullable(),
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
    })
    .refine((payload) => (payload.toAgentId === undefined) !== (payload.toModuleKey === undefined))

const workItemRaisePayload: z.ZodType<WorkItemRaisePayload> = z.object({
    action: id,
    title: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
    amountVnd: z.number().nonnegative().optional(),
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
})

/** Confirms an order; the subject is the order. */
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
})

/** Every effect the core nodes may run; the back end registers an executor for each. */
export const coreEffects: ReadonlyArray<EffectDefinition> = [
    channelSendEffect,
    orderRecordEffect,
    orderConfirmEffect,
    paymentMarkPaidEffect,
    paymentClaimRecordEffect,
    agentTagEffect,
    workItemRaiseEffect,
] as ReadonlyArray<EffectDefinition>
