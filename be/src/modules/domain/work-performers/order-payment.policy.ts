import { z } from "zod"
import type { ZodType } from "zod"
import type { Arrival, Brief, Candidate, Claim, Judgement } from "@nivo-lite/agent-sdk/reconcile"
import type { InboundEventDetail } from "@modules/domain/inbound-events"
import { AWAITING_PAYMENT_STATUSES } from "@modules/domain/orders"
import type { PaymentClaimRow, SalesOrderListRow } from "@modules/domain/orders"

/** How the settlement refers to the target of a reconcile item that pays a sales order. */
export const ORDER_TARGET = "order"

/** The amount a Vietnamese claim names, with its unit: "5k", "5.000đ", "1,5 triệu", "20000". */
const AMOUNT = /(\d+(?:[.,]\d+)*)\s*(k|nghin|ngan|tr|trieu|d|vnd)?(?![a-z0-9])/gu

/** The smallest amount a bare number is taken for: a "2" in "2 chậu" is a quantity, not money. */
const MIN_AMOUNT_VND = 1000

const UNIT: Readonly<Record<string, number>> = { k: 1000, nghin: 1000, ngan: 1000, tr: 1_000_000, trieu: 1_000_000 }

const foldAscii = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/đ/giu, "d")
        .toLowerCase()

/** The value of one number token: "5.000" is five thousand, "1,5" before a unit is one and a half. */
const valueOf = (token: string, factor: number): number => {
    const decimal = /^\d+[.,]\d{1,2}$/u.test(token) && factor > 1
    return decimal ? Number(token.replace(",", ".")) * factor : Number(token.replace(/[.,]/gu, "")) * factor
}

/** The first amount of money a customer's words name, or null when they name none. */
export const claimAmountOf = (text: string): number | null => {
    for (const match of foldAscii(text).matchAll(AMOUNT)) {
        const token = match[1] ?? ""
        const amount = Math.round(valueOf(token, UNIT[match[2] ?? ""] ?? 1))
        if (amount >= MIN_AMOUNT_VND) return amount
    }
    return null
}

/** The words after "tên" / "chủ tài khoản" in the claim: the account holder the customer gave. */
const HOLDER = /(?:ten|chu tai khoan|chu tk|nguoi chuyen)\s*[:-]?\s*([\p{L}][\p{L} ]{1,60})/iu

/** The account holder a customer names ("tên BUI NGUYEN DINH"), as an array of at most one name. */
export const claimNamesOf = (text: string): Array<string> => {
    const folded = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/giu, "d")
    const holder = HOLDER.exec(folded)?.[1]?.trim()
    return holder === undefined || holder === "" ? [] : [holder]
}

/** The orders that wait for money, opened inside the window, as candidates the evidence is gathered for. */
export const candidatesOf = (
    orders: ReadonlyArray<SalesOrderListRow>,
    since: number,
    label: (order: SalesOrderListRow) => string,
): Array<Candidate> =>
    orders.flatMap((order) => {
        const openedAt = Date.parse(order.confirmed_at ?? order.created_at)
        if (!AWAITING_PAYMENT_STATUSES.includes(order.status as never) || order.amount_vnd === null) return []
        if (openedAt < since) return []
        return [
            {
                id: order.id,
                label: label(order),
                amountDue: order.amount_vnd,
                partyName: order.contact_name,
                partyKey: order.lead_id,
                codes: [order.order_no],
                openedAt,
            },
        ]
    })

/** The bank credit as an arrival: the words of the transfer content and the sender's name, when the feed gave one. */
export const arrivalOf = (event: InboundEventDetail, amount: number, at: number): Arrival => ({
    id: event.id,
    amount,
    text: `${event.external_ref ?? ""} ${event.body}`.trim(),
    names: event.sender_name === null ? [] : [event.sender_name],
    at,
})

/** A stored payment claim as the ledger of the SDK reads it. */
export const claimOf = (row: PaymentClaimRow): Claim => ({
    id: row.id,
    partyKey: row.leadId,
    amount: row.amountVnd,
    names: row.names,
    text: row.body,
    at: row.claimedAt.getTime(),
    status: row.status,
})

/** What the judge answers: a verdict, the order it names, and at most four reasons. */
export const JUDGEMENT_SCHEMA: ZodType<{ verdict: Judgement["verdict"]; candidate_id: string | null; reasons: Array<string> }> =
    z.object({
        verdict: z.enum(["match", "no_match", "ambiguous"]),
        candidate_id: z.string().max(64).nullable(),
        reasons: z.array(z.string().min(1).max(240)).max(4),
    })

/** The judgement the SDK works with, from the judge's answer. */
export const judgementOf = (answer: z.infer<typeof JUDGEMENT_SCHEMA>): Judgement => ({
    verdict: answer.verdict,
    candidateId: answer.candidate_id,
    reasons: answer.reasons,
})

/** The standing instructions of the judge. */
export const JUDGE_SYSTEM_PROMPT = [
    "You reconcile one incoming bank transfer to the open sales orders of a small shop.",
    "You get the transfer (amount, transfer content, counter name, time), the open orders with the evidence already checked for each, and what the customers said about paying.",
    "Answer with a JSON object: verdict (match | no_match | ambiguous), candidate_id (the id of the order a match names, else null) and reasons (up to four short sentences).",
    "Answer match only when exactly one order fits: the amount equals the amount due, and the payer name or the customer's claim points to that order's customer.",
    "Answer ambiguous when two or more orders fit, or when the evidence is thin or contradicts itself. Answer no_match when the transfer plainly belongs to none of them.",
    "Never guess: a wrong match marks an order paid. Names are compared without diacritics or case. Write the reasons in the language of the shop (Vietnamese).",
].join("\n")

/** The user message of the judge: the brief as plain JSON. */
export const judgeBriefOf = (brief: Brief): string =>
    JSON.stringify({
        transfer: {
            amount: brief.arrival.amount,
            content: brief.arrival.text,
            names: brief.arrival.names,
            at: new Date(brief.arrival.at).toISOString(),
        },
        orders: brief.candidates.map((one) => ({
            id: one.candidate.id,
            order: one.candidate.label,
            amount_due: one.candidate.amountDue,
            customer: one.candidate.partyName,
            opened_at: new Date(one.candidate.openedAt).toISOString(),
            evidence: one.evidence.map((item) => ({ check: item.key, holds: item.met, detail: item.detail })),
        })),
        customer_claims: brief.claims.map((claim) => ({
            customer: claim.partyKey,
            amount: claim.amount,
            names: claim.names,
            said: claim.text,
            at: new Date(claim.at).toISOString(),
        })),
    })
