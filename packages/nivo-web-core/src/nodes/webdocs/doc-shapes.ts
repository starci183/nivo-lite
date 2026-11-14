import { z } from "zod"

/**
 * The shapes of the Paperwork steps (copied from `nodes/webdocs/doc-shapes.ts` for the converted tree): every record is a type alias,
 * never an interface, so a step hands it to `agent.run` as the `JsonValue` it takes.
 */

/** The most sources one request reads and hands to the draft. */
export const SOURCES_MAX = 12

/** The longest piece of a source handed to the draft. */
export const EXCERPT_MAX = 1500

/** The longest note of the facts the read gathered. */
export const FACTS_MAX = 3000

/** The longest request a step reads (the team chat's own most). */
export const REQUEST_MAX = 2000

/** The longest answer posted (the team post's own most): the draft with its sources, or a short answer. */
export const ANSWER_MAX = 4000

/** The most room lines a request carries (the team chat's own most). */
export const LINES_MAX = 12

/** The language the team reads. */
export type TeamLocale = "vi" | "en"

/** Where one source was read: a passage of a business document, a truth in force, or a CRM record. */
export type SourceKind = "passage" | "truth" | "crm"

/** One source the draft may use, as the read step copied it. */
export type DocSource = {
    /** Where it was read. */
    readonly kind: SourceKind
    /** How to find it again: the passage id, the truth id, or the CRM tool and code (`nivo.api.crm.nivoweb.get.customers.code.contracts ACME`). */
    readonly ref: string
    /** The document's title, the truth's subject, or the record's name. */
    readonly title: string
    /** The words that matter, copied, never rewritten. */
    readonly excerpt: string
}

/** One line of the room around a request, as the team-chat router hands it. */
export type RoomLine = {
    /** The message id. */
    readonly id: string
    /** Who wrote it. */
    readonly by: "person" | "agent" | "system"
    /** Their name. */
    readonly name: string
    /** The words, cut to a line. */
    readonly text: string
    /** When, ISO. */
    readonly at: string
}

/** Who asked, as the team-chat router hands it. */
export type Asker = {
    /** The person's name in the team. */
    readonly name: string
    /** Owner, manager or staff. */
    readonly standing: "owner" | "manager" | "staff"
}

/** The schema of the team's language. */
export const localeSchema: z.ZodType<TeamLocale, TeamLocale> = z.enum(["vi", "en"])

/** The schema of one room line. */
export const roomLineSchema: z.ZodType<RoomLine, RoomLine> = z.object({
    id: z.string().min(1).max(200),
    by: z.enum(["person", "agent", "system"]),
    name: z.string().max(500),
    text: z.string().max(300),
    at: z.string().max(200),
})

/** The schema of who asked. */
export const askerSchema: z.ZodType<Asker, Asker> = z.object({
    name: z.string().max(500),
    standing: z.enum(["owner", "manager", "staff"]),
})

/** One line of a purchase's quote, copied from the CRM's answer: the CRM computed every amount from its price table. */
export type PurchaseLineFacts = {
    /** The CRM code of the price row. */
    readonly priceCode: string
    /** The line's name as the document shows it. */
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

/** A purchase's quote, copied from the CRM's answer: its lines, net, VAT and total, and the days it was given and holds until. */
export type PurchaseQuoteFacts = {
    /** The rows of the list, in order. */
    readonly lines: ReadonlyArray<PurchaseLineFacts>
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

/** The facts of one purchase (a new sale) a contract draft is written from, copied from `nivo.api.crm.nivoweb.get.purchases.id`, never computed. */
export type PurchaseFacts = {
    /** The purchase's `id`. */
    readonly id: string
    /** The code a person reads (`MUA-...`). */
    readonly code: string
    /** Its state in the CRM. */
    readonly state: string
    /** The customer it belongs to, when the CRM holds one. */
    readonly customerCode: string | null
    /** When the customer's yes was recorded; null while it is not. */
    readonly acceptedAt: string | null
    /** The payment code the customer writes on the transfer. */
    readonly paymentCode: string | null
    /** The contract number the CRM already gave it, if any. */
    readonly contractNo: string | null
    /** Its current quote; null when it holds none. */
    readonly quote: PurchaseQuoteFacts | null
}

const vnd = (what: string): z.ZodNumber =>
    z.number().int().describe(`${what}, copied from the CRM's answer, never computed.`)

/** The schema of one quote line. */
const purchaseLineSchema: z.ZodType<PurchaseLineFacts, PurchaseLineFacts> = z.object({
    priceCode: z.string().min(1).max(80),
    name: z.string().min(1).max(200),
    termMonths: z.number().int().nullable(),
    quantity: z.number().int(),
    unitPriceVnd: vnd("The unit price in VND"),
    amountVnd: vnd("The line's amount in VND"),
})

/** The schema of a purchase's quote. */
const purchaseQuoteSchema: z.ZodType<PurchaseQuoteFacts, PurchaseQuoteFacts> = z.object({
    lines: z.array(purchaseLineSchema).max(20),
    netVnd: vnd("The net amount in VND"),
    vatRatePercent: z.number().int().describe("The VAT rate in percent, as the CRM answered it."),
    vatVnd: vnd("The VAT in VND"),
    totalVnd: vnd("The total in VND"),
    quotedOn: z.string().max(40),
    validUntil: z.string().max(40),
})

/** The schema of a purchase's facts, every member copied from the purchase read. */
export const purchaseFactsSchema: z.ZodType<PurchaseFacts, PurchaseFacts> = z.object({
    id: z.string().min(1).max(120),
    code: z.string().min(1).max(40),
    state: z.string().min(1).max(40),
    customerCode: z.string().min(1).max(80).nullable(),
    acceptedAt: z.string().max(40).nullable(),
    paymentCode: z.string().min(1).max(20).nullable(),
    contractNo: z.string().min(1).max(120).nullable(),
    quote: purchaseQuoteSchema.nullable(),
})

/** The schema of one source, every member described for the model. */
export const docSourceSchema: z.ZodType<DocSource, DocSource> = z.object({
    kind: z
        .enum(["passage", "truth", "crm"])
        .describe("Where you read it: a document passage, a truth in force, or a CRM record."),
    ref: z
        .string()
        .min(1)
        .max(200)
        .describe(
            "How to find it again: the passage id, the truth id, or the CRM tool id and the code you read it by.",
        ),
    title: z
        .string()
        .min(1)
        .max(300)
        .describe("The document's title, the truth's subject, or the record's name, as the tool answered it."),
    excerpt: z
        .string()
        .min(1)
        .max(EXCERPT_MAX)
        .describe("The words of the source the draft needs, copied as the tool answered them, never rewritten."),
})
