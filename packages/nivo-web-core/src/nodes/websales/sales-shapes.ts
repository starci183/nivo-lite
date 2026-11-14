import { z } from "zod"

/** The longest customer text a step reads (one burst of messages, or a mail's summary). */
export const TEXT_MAX = 8000

/** The longest one-line summary a step writes for the team. */
export const LINE_MAX = 600

/** The longest message a step sends a customer. */
export const REPLY_MAX = 2000

/** The longest mail subject a step writes. */
export const SUBJECT_MAX = 200

/** The longest id or code (a conversation id, a purchase id, a purchase code). */
export const ID_MAX = 120

/** The most price rows one quote holds (the CRM's own most). */
export const ITEMS_MAX = 20

/** The most purchases one follow-up round handles: the loop's own cap (contract C1), and the CRM list's page. */
export const ROUND_MAX = 50

/** The language the team reads. */
export type TeamLocale = "vi" | "en"

/** The schema of the team's language. */
export const localeSchema: z.ZodType<TeamLocale> = z.enum(["vi", "en"])

/** An id passed on from a trigger, or nothing. */
export const optionalId: z.ZodType<string | null | undefined> = z.string().min(1).max(ID_MAX).nullish()

/** One line for the team. */
export const lineSchema: z.ZodType<string> = z.string().min(1).max(LINE_MAX)

/** Where an enquiry came in, as the CRM's purchase records it (its own enum, not a provider). */
export type CrmChannel = "zalo" | "email" | "phone" | "web" | "other"

/** The schema of the CRM's channel enum. */
export const crmChannelSchema: z.ZodType<CrmChannel> = z.enum(["zalo", "email", "phone", "web", "other"])

/** The purchase a step works on: the CRM's id (what the tools take) and its code (what a person reads). */
export type PurchaseRef = {
    /** The purchase's `id`, as the CRM answered it. */
    readonly purchaseId: string
    /** The purchase's `code` (`MUA-...`), as the CRM answered it. */
    readonly purchaseCode: string
}

/** The zod members of a purchase reference. */
export type PurchaseRefShape = {
    /** The schema of the `purchaseId` member. */
    readonly purchaseId: z.ZodString
    /** The schema of the `purchaseCode` member. */
    readonly purchaseCode: z.ZodString
}

/** The members of a purchase reference, every one described for the model. */
export const purchaseRefShape: PurchaseRefShape = {
    purchaseId: z.string().min(1).max(ID_MAX).describe("The purchase's `id`, as the CRM answered it."),
    purchaseCode: z.string().min(1).max(ID_MAX).describe("The purchase's `code` (MUA-\u2026), as the CRM answered it."),
}

/** One row of the price list a quote is made of, as the understand step hands it to the quote step. */
export type QuoteItem = {
    /** The row, by its `priceCode` as the price list answered it. */
    readonly priceCode: string
    /** The term in months the person said, or null when they said none (or the row is not sold by term). */
    readonly termMonths: number | null
}

/** The schema of one quote item. */
export const quoteItemSchema: z.ZodType<QuoteItem> = z.object({
    priceCode: z.string().min(1).max(80).describe("The row's `priceCode`, copied from the price list's answer."),
    termMonths: z
        .number()
        .int()
        .min(1)
        .max(120)
        .nullable()
        .describe("The term in months the person said; null when they said none."),
})

/** One line of a quote, as the CRM computed it. */
export type QuoteLine = {
    /** The CRM code of the price row. */
    readonly priceCode: string
    /** The line's name as the quote shows it. */
    readonly name: string
    /** The term in months; null when the CRM's own default applies. */
    readonly termMonths: number | null
    /** How many units. */
    readonly quantity: number
    /** The price of one unit in VND. */
    readonly unitPriceVnd: number
    /** The amount in VND. */
    readonly amountVnd: number
}

/** A quote of a purchase, every figure the CRM's (`QuoteResponse` of the CRM document). */
export type Quote = {
    /** The rows of the list, in order. */
    readonly lines: ReadonlyArray<QuoteLine>
    /** The net amount in VND, before VAT. */
    readonly netVnd: number
    /** The VAT rate in percent. */
    readonly vatRatePercent: number
    /** The VAT amount in VND. */
    readonly vatVnd: number
    /** The total in VND, VAT included. */
    readonly totalVnd: number
    /** The day the quote was made (ISO date). */
    readonly quotedOn: string
    /** The last day the quote holds (ISO date). */
    readonly validUntil: string
}

const day = z.string().max(40)

/** The schema of a quote as the CRM answers it (the members the steps read; `priceSource` is the CRM's own refusal concern). */
export const quoteSchema: z.ZodType<Quote> = z.object({
    lines: z
        .array(
            z.object({
                priceCode: z.string().max(80),
                name: z.string().max(400),
                termMonths: z.number().int().nullable(),
                quantity: z.number().int(),
                unitPriceVnd: z.number().int(),
                amountVnd: z.number().int(),
            }),
        )
        .max(ITEMS_MAX),
    netVnd: z.number().int(),
    vatRatePercent: z.number().int(),
    vatVnd: z.number().int(),
    totalVnd: z.number().int(),
    quotedOn: day,
    validUntil: day,
})

/** One purchase as the CRM's `purchase.get` (and the purchase writes) answer it: the members the steps read. */
export type Purchase = {
    /** The CRM id of the purchase. */
    readonly id: string
    /** The CRM code of the purchase. */
    readonly code: string
    /** The state of the purchase in the CRM. */
    readonly state: string
    /** The channel the purchase came by. */
    readonly channel: CrmChannel
    /** The id the source message gave the purchase. */
    readonly sourceRef: string
    /** What the customer asked for, in their words. */
    readonly need: string
    /** The contact person's name; null when unknown. */
    readonly contactName: string | null
    /** The phone number; null when unknown. */
    readonly phone: string | null
    /** The email address; null when unknown. */
    readonly email: string | null
    /** The domain name; null when none. */
    readonly domain: string | null
    /** The CRM code of the customer this concerns; null when the person is not matched to one. */
    readonly customerCode: string | null
    /** The quote the CRM made; null when none was made. */
    readonly quote: Quote | null
}

const optionalText = z.string().max(400).nullable()

/** The schema of a purchase as the CRM answers it; members the steps do not read pass unread. */
export const purchaseSchema: z.ZodType<Purchase> = z.looseObject({
    id: z.string().min(1).max(ID_MAX),
    code: z.string().min(1).max(ID_MAX),
    state: z.string().max(40),
    channel: crmChannelSchema,
    sourceRef: z.string().min(1).max(200),
    need: z.string().max(4000),
    contactName: optionalText,
    phone: optionalText,
    email: optionalText,
    domain: optionalText,
    customerCode: z.string().max(ID_MAX).nullable(),
    quote: quoteSchema.nullable(),
})

/** One quoted purchase the sales rules say to follow up today, as the round hands it to the follow-up step. */
export type DuePurchase = PurchaseRef & {
    /** Where the enquiry came in, as the CRM lists it. */
    readonly channel: CrmChannel
    /** The conversation or mail the enquiry came in, by its id. */
    readonly sourceRef: string
    /** The day the quote was made. */
    readonly quotedOn: string | null
    /** The day the quote stops holding. */
    readonly validUntil: string | null
    /** The day of the last follow-up, when there was one. */
    readonly lastFollowUpOn: string | null
    /** How many follow-ups were recorded. */
    readonly followUpCount: number
}

/** The zod members of one due purchase. */
export type DuePurchaseShape = {
    /** The schema of the `purchaseId` member. */
    readonly purchaseId: z.ZodString
    /** The schema of the `purchaseCode` member. */
    readonly purchaseCode: z.ZodString
    /** The schema of the `channel` member. */
    readonly channel: z.ZodType<CrmChannel>
    /** The schema of the `sourceRef` member. */
    readonly sourceRef: z.ZodString
    /** The schema of the `quotedOn` member. */
    readonly quotedOn: z.ZodNullable<z.ZodString>
    /** The schema of the `validUntil` member. */
    readonly validUntil: z.ZodNullable<z.ZodString>
    /** The schema of the `lastFollowUpOn` member. */
    readonly lastFollowUpOn: z.ZodNullable<z.ZodString>
    /** The schema of the `followUpCount` member. */
    readonly followUpCount: z.ZodNumber
}

/** The members of one due purchase, every one described for the model (for a schema that extends it). */
export const duePurchaseShape: DuePurchaseShape = {
    purchaseId: z.string().min(1).max(ID_MAX).describe("The purchase's `id` as the list answered it."),
    purchaseCode: z.string().min(1).max(ID_MAX).describe("The purchase's `code` as the list answered it."),
    channel: crmChannelSchema.describe("The `channel` as the list answered it."),
    sourceRef: z.string().min(1).max(200).describe("The `sourceRef` as the list answered it."),
    quotedOn: day.nullable().describe("The `quotedOn` as the list answered it."),
    validUntil: day.nullable().describe("The `validUntil` as the list answered it."),
    lastFollowUpOn: day.nullable().describe("The `lastFollowUpOn` as the list answered it."),
    followUpCount: z.number().int().nonnegative().describe("The `followUpCount` as the list answered it."),
}

const dueObject = z.object(duePurchaseShape)

/** The schema of one due purchase, every member described for the model. */
export const duePurchaseSchema: z.ZodType<DuePurchase> = dueObject

/** Why a quoted purchase the rules would follow up today is not followed up now. */
export type HeldWhy = "open_followup" | "unreachable" | "stop_rule" | "expired_quote"

/** One purchase the rules would follow up but the round holds, with why. */
export type HeldPurchase = PurchaseRef & {
    /** Why it is held. */
    readonly why: HeldWhy
}

/** The schema of why a purchase is held, described for the model. */
export const heldWhySchema: z.ZodType<HeldWhy> = z
    .enum(["open_followup", "unreachable", "stop_rule", "expired_quote"])
    .describe(
        "open_followup: the last follow-up still waits for an answer; unreachable: no way to reach the person is known; stop_rule: the sales policy says to stop following up and tell the team; expired_quote: the quote no longer holds, a person decides whether to quote again.",
    )

/** The schema of one held purchase. */
export const heldPurchaseSchema: z.ZodType<HeldPurchase> = z.object({
    purchaseId: z.string().min(1).max(ID_MAX).describe("The purchase's `id`."),
    purchaseCode: z.string().min(1).max(ID_MAX).describe("The purchase's `code`."),
    why: heldWhySchema,
})

/**
 * What one item of the round did, as its send step (`websales.follow-send`) answers it: the purchase, whether the reminder went out
 * (an item that cannot be sent ends with `sent: false` and the report names it; it never freezes the round), the CRM's channel word
 * for the record, the channel the customer was reached on (the conversation's channel the send's effect facts named, `value.channel`:
 * `zalo`, `telegram`, `website`, ...; `email` for a mail draft), the id the send answered, whether a person declined it, and why it
 * was not sent. The round's loop COLLECTS
 * this step, which every item reaches, so the report reads the why of an item not sent; a sent item is recorded by the next body
 * step (blocking: the round does not reach its report with a sent item unrecorded).
 */
export type SentFollowUp = PurchaseRef & {
    /** True when the reminder went out. */
    readonly sent: boolean
    /** The CRM's channel of the follow-up (its enum): the purchase's own for a conversation send, `email` for a mail; null when not sent. */
    readonly recordChannel: CrmChannel | null
    /** The channel the send went through (`value.channel` of the effect, `email` for a mail); null when not sent. */
    readonly channel: string | null
    /** The id the send answered (the message, or the mail draft's work item); null when not sent. */
    readonly messageRef: string | null
    /** Why it was not sent: the send's refusal (`declined` when a person declined it), or `no_contact`; null when sent. */
    readonly refusal: string | null
    /** True when a person declined the send (a decision: the item ends after the team's notice, the round goes on). */
    readonly declined: boolean
}

/** The schema of one item's follow-up. */
export const sentFollowUpSchema: z.ZodType<SentFollowUp> = z.object({
    purchaseId: z.string().min(1).max(ID_MAX),
    purchaseCode: z.string().min(1).max(ID_MAX),
    sent: z.boolean(),
    recordChannel: crmChannelSchema.nullable(),
    channel: z.string().min(1).max(40).nullable(),
    messageRef: z.string().min(1).max(200).nullable(),
    refusal: z.string().min(1).max(200).nullable(),
    declined: z.boolean(),
})
