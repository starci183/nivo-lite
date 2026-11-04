import type { Arrival, Claim, Evidenced } from "@nivo-lite/agent-sdk/reconcile"
import { z } from "zod"
import { MAX_BODY, MAX_ENTRIES, MAX_ID, MAX_LINE } from "../../bounds"

/** The statuses of an order that waits for money. */
export const AWAITING_PAYMENT: ReadonlyArray<string> = ["confirmed", "invoiced"]

/** One bank transaction as the `bank-transaction` data kind yields it (instants as ISO text). */
export type TransactionRow = {
    /** The id of the row. */
    readonly id: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The transfer content the bank recorded. */
    readonly content: string
    /** The name of the sender the bank recorded, or null. */
    readonly counterpartName: string | null
    /** When the money arrived, as ISO text. */
    readonly receivedAt: string
    /** The order the transaction is linked to, or null. */
    readonly orderId: string | null
    /** The status of the transaction. */
    readonly status: string
}

/** One sales order as the `order` data kind yields it. */
export type OrderRow = {
    /** The id of the row. */
    readonly id: string
    /** The number the customer is told. */
    readonly orderNo: string
    /** The customer the row belongs to. */
    readonly leadId: string
    /** The items the customer named. */
    readonly items: ReadonlyArray<Readonly<Record<string, unknown>>>
    /** The amount in VND. */
    readonly amountVnd: number | null
    /** The status of the row. */
    readonly status: string
    /** When the order was confirmed, or null. */
    readonly confirmedAt: string | null
    /** When the order was created, as ISO text. */
    readonly createdAt: string
}

/** One customer as the `sales-lead` data kind yields it. */
export type LeadRow = {
    /** The id of the row. */
    readonly id: string
    /** The name of the customer, or null. */
    readonly contactName: string | null
}

/** One conversation as the `conversation` data kind yields it. */
export type ConversationRow = {
    /** The id of the row. */
    readonly id: string
    /** The customer the row belongs to. */
    readonly leadId: string | null
    /** When the last message arrived, or null. */
    readonly lastMessageAt: string | null
}

/** One customer payment claim as the `payment-claim` data kind yields it. */
export type ClaimRow = {
    /** The id of the row. */
    readonly id: string
    /** The customer the row belongs to. */
    readonly leadId: string | null
    /** The conversation the claim came in, or null. */
    readonly conversationId: string | null
    /** The amount in VND. */
    readonly amountVnd: number | null
    /** The names the customer wrote with the claim. */
    readonly names: ReadonlyArray<string>
    /** The text of the row. */
    readonly body: string
    /** When the customer claimed, as ISO text. */
    readonly claimedAt: string
    /** The status of the claim. */
    readonly status: string
}

/** An instant as epoch milliseconds. */
export const atOf = (value: string): number => Date.parse(value)

/** An order that has an amount due. */
export type PricedOrder = OrderRow & {
    /** The amount due in VND. */
    readonly amountVnd: number
}

export const arrivalSchema: z.ZodType<Arrival, Arrival> = z.object({
    id: z.string().max(MAX_ID),
    amount: z.number(),
    text: z.string().max(MAX_BODY),
    names: z.array(z.string().max(MAX_LINE)).max(MAX_ENTRIES),
    at: z.number(),
})

export const evidencedSchema: z.ZodType<Evidenced, Evidenced> = z.object({
    candidate: z.object({
        id: z.string().max(MAX_ID),
        label: z.string().max(MAX_LINE),
        amountDue: z.number(),
        partyName: z.string().max(MAX_LINE).nullable(),
        partyKey: z.string().max(MAX_ID).nullable(),
        codes: z.array(z.string().max(MAX_ID)).max(MAX_ENTRIES),
        openedAt: z.number(),
    }),
    evidence: z
        .array(
            z.object({
                key: z.enum(["code", "amount", "name", "recency", "claim"]),
                met: z.boolean(),
                detail: z.string().max(MAX_BODY),
            }),
        )
        .max(MAX_ENTRIES),
    score: z.number(),
})

export const claimSchema: z.ZodType<Claim, Claim> = z.object({
    id: z.string().max(MAX_ID),
    partyKey: z.string().max(MAX_ID).nullable(),
    amount: z.number().nullable(),
    names: z.array(z.string().max(MAX_LINE)).max(MAX_ENTRIES),
    text: z.string().max(MAX_BODY),
    at: z.number(),
    status: z.enum(["open", "settled", "escalated"]),
})

/** What the judge's model answers. */
export interface JudgementAnswer {
    /** What the judge decided. */
    readonly verdict: "match" | "no_match" | "ambiguous"
    /** The order the judge picked, or null. */
    readonly candidate_id: string | null
    /** The reasons the judge gives. */
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
    /** The ids of the candidates the decision names. */
    readonly candidateIds: ReadonlyArray<string>
    /** The reasons the decision gives. */
    readonly reasons: ReadonlyArray<string>
}
