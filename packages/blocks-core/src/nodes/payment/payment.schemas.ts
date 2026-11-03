import type { Arrival, Claim, Evidenced } from "@nivo-lite/agent-sdk/reconcile"
import { z } from "zod"

/** The statuses of an order that waits for money. */
export const AWAITING_PAYMENT: ReadonlyArray<string> = ["confirmed", "invoiced"]

/** One bank transaction as the `bank-transaction` data kind yields it (instants as ISO text). */
export type TransactionRow = {
    readonly id: string
    readonly amountVnd: number
    readonly content: string
    readonly counterpartName: string | null
    readonly receivedAt: string
    readonly orderId: string | null
    readonly status: string
}

/** One sales order as the `order` data kind yields it. */
export type OrderRow = {
    readonly id: string
    readonly orderNo: string
    readonly leadId: string
    readonly items: ReadonlyArray<Readonly<Record<string, unknown>>>
    readonly amountVnd: number | null
    readonly status: string
    readonly confirmedAt: string | null
    readonly createdAt: string
}

/** One customer as the `sales-lead` data kind yields it. */
export type LeadRow = {
    readonly id: string
    readonly contactName: string | null
}

/** One conversation as the `conversation` data kind yields it. */
export type ConversationRow = {
    readonly id: string
    readonly leadId: string | null
    readonly lastMessageAt: string | null
}

/** One customer payment claim as the `payment-claim` data kind yields it. */
export type ClaimRow = {
    readonly id: string
    readonly leadId: string | null
    readonly conversationId: string | null
    readonly amountVnd: number | null
    readonly names: ReadonlyArray<string>
    readonly body: string
    readonly claimedAt: string
    readonly status: string
}

/** An instant as epoch milliseconds. */
export const atOf = (value: string): number => Date.parse(value)

/** An order that has an amount due. */
export type PricedOrder = OrderRow & { readonly amountVnd: number }

export const arrivalSchema: z.ZodType<Arrival, Arrival> = z.object({
    id: z.string(),
    amount: z.number(),
    text: z.string(),
    names: z.array(z.string()),
    at: z.number(),
})

export const evidencedSchema: z.ZodType<Evidenced, Evidenced> = z.object({
    candidate: z.object({
        id: z.string(),
        label: z.string(),
        amountDue: z.number(),
        partyName: z.string().nullable(),
        partyKey: z.string().nullable(),
        codes: z.array(z.string()),
        openedAt: z.number(),
    }),
    evidence: z.array(
        z.object({
            key: z.enum(["code", "amount", "name", "recency", "claim"]),
            met: z.boolean(),
            detail: z.string(),
        }),
    ),
    score: z.number(),
})

export const claimSchema: z.ZodType<Claim, Claim> = z.object({
    id: z.string(),
    partyKey: z.string().nullable(),
    amount: z.number().nullable(),
    names: z.array(z.string()),
    text: z.string(),
    at: z.number(),
    status: z.enum(["open", "settled", "escalated"]),
})

/** What the judge's model answers. */
export interface JudgementAnswer {
    readonly verdict: "match" | "no_match" | "ambiguous"
    readonly candidate_id: string | null
    readonly reasons: ReadonlyArray<string>
}

export const judgementAnswerSchema: z.ZodType<JudgementAnswer, JudgementAnswer> = z.object({
    verdict: z.enum(["match", "no_match", "ambiguous"]),
    candidate_id: z.string().max(64).nullable(),
    reasons: z.array(z.string().min(1).max(240)).max(4),
})

/** The decision the judge or the code rule hands to the settlement. */
export type SettleMode = "apply" | "ask"

/** The ids of the candidates a decision names, with the reasons it gives. */
export interface Named {
    readonly candidateIds: ReadonlyArray<string>
    readonly reasons: ReadonlyArray<string>
}
