import { refused } from "../web-answers"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import {
    ITEMS_MAX,
    type PurchaseRef,
    type Quote,
    type QuoteItem,
    purchaseRefShape,
    purchaseSchema,
    quoteItemSchema,
    quoteSchema,
} from "./sales-shapes"
import { DECLINED, parsedOrCannot, valueOrCannot } from "./websales-calls"
import { PURCHASE, PURCHASE_ID, QUOTE, crmAnswered, purchaseOf } from "./websales.fixtures"
import { websalesText } from "../../modules/websales/copy"

/** The purchase and the price rows the need points at. */
export type QuoteCreateInput = PurchaseRef & {
    /** The price rows to quote. */
    readonly items: ReadonlyArray<QuoteItem>
}

/**
 * The purchase and the quote the CRM made, every figure the CRM's; `quote` null and `declined` true when a person declined the quote
 * (a decision: no quote is made, the graph posts the team's notice and ends `declined`, or ends the mail's item).
 */
export type QuoteCreateOutput = PurchaseRef & {
    /** The quote the CRM made; null when a person declined it. */
    readonly quote: Quote | null
    /** True when a person declined making the quote. */
    readonly declined: boolean
}

const ID = "websales.quote-create"

const input: z.ZodType<QuoteCreateInput> = z.object({
    ...purchaseRefShape,
    items: z.array(quoteItemSchema).min(1).max(ITEMS_MAX),
})

const output: z.ZodType<QuoteCreateOutput> = z.object({
    ...purchaseRefShape,
    quote: quoteSchema.nullable(),
    declined: z.boolean(),
})

/** One price row as the quote takes it: `termMonths` only when it is not null (the CRM's own default otherwise). */
const itemArgsOf = (item: QuoteItem): Readonly<Record<string, string | number>> =>
    item.termMonths === null
        ? { priceCode: item.priceCode }
        : { priceCode: item.priceCode, termMonths: item.termMonths }

/**
 * `websales.quote-create` (Lap bao gia): split from `websales.quote`, and reused by the mailed enquiries. A plain call (no AI):
 * the CRM makes the quote of the purchase from the price list (`purchase.quote.create`: a CRM write, `auto`) and computes every
 * line, the VAT, the total and how long it holds. A refusal (`price_placeholder` while the price sheet is not loaded) is NO
 * quote: the node stops, so nothing downstream can state a figure, and the engine reports it to the team. A person who declines
 * the quote made a decision: the step returns `quote: null`, `declined: true` (never a failure).
 */
export const websalesQuoteCreateNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: websalesText("node.quote-create.title"),
    description: { vi: "L\u1eadp b\u00e1o gi\u00e1 cho \u0111\u01a1n mua t\u1eeb b\u1ea3ng gi\u00e1; h\u1ec7 th\u1ed1ng t\u00ednh t\u1eebng d\u00f2ng, thu\u1ebf, t\u1ed5ng ti\u1ec1n v\u00e0 th\u1eddi h\u1ea1n hi\u1ec7u l\u1ef1c.", en: "Creates the quote for the purchase from the price list; the system works out each line, tax, total and how long it holds." },
    tools: [CRM_NIVOWEB.post_purchases_id_quotes],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    run: async (given, context) => {
        const answer = await context.tools.call(CRM_NIVOWEB.post_purchases_id_quotes, {
            id: given.purchaseId,
            items: given.items.map((entry) => itemArgsOf(entry)),
        })
        const ref = { purchaseId: given.purchaseId, purchaseCode: given.purchaseCode }
        if (!answer.ok && answer.declined === true) return { ...ref, quote: null, declined: true }
        const purchase = parsedOrCannot(
            context,
            CRM_NIVOWEB.post_purchases_id_quotes,
            purchaseSchema,
            valueOrCannot(context, CRM_NIVOWEB.post_purchases_id_quotes, answer),
        )
        if (purchase.quote === null)
            return context.fail({ kind: "cannot", why: `${CRM_NIVOWEB.post_purchases_id_quotes} answered no quote` })
        return { ...ref, quote: purchase.quote, declined: false }
    },
    examples: [
        {
            name: "has the CRM make the quote and carries its lines, total and validity exactly as answered",
            params: {},
            input: { ...PURCHASE, items: [{ priceCode: "WEB-SHOP", termMonths: null }] },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_quotes,
                    args: { id: PURCHASE_ID, items: [{ priceCode: "WEB-SHOP" }] },
                    answer: crmAnswered(purchaseOf({ state: "quoted", quote: QUOTE })),
                },
            ],
            output: {
                ...PURCHASE,
                quote: {
                    lines: [
                        {
                            priceCode: "WEB-SHOP",
                            name: "Website ban hang",
                            termMonths: null,
                            quantity: 1,
                            unitPriceVnd: 12_000_000,
                            amountVnd: 12_000_000,
                        },
                    ],
                    netVnd: 12_000_000,
                    vatRatePercent: 10,
                    vatVnd: 1_200_000,
                    totalVnd: 13_200_000,
                    quotedOn: "2026-11-09",
                    validUntil: "2026-11-23",
                },
                declined: false,
            },
        },
        {
            name: "a placeholder price row is no quote: the step stops with the CRM's refusal",
            params: {},
            input: { ...PURCHASE, items: [{ priceCode: "HOST-1", termMonths: 12 }] },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_quotes,
                    args: { id: PURCHASE_ID, items: [{ priceCode: "HOST-1", termMonths: 12 }] },
                    answer: refused("price_placeholder", { priceCode: "HOST-1" }),
                },
            ],
            failure: { kind: "cannot", why: `${CRM_NIVOWEB.post_purchases_id_quotes} refused: price_placeholder` },
        },
        {
            name: "a person who declines the quote is a decision: no quote is made and the step returns declined",
            params: {},
            input: { ...PURCHASE, items: [{ priceCode: "WEB-SHOP", termMonths: null }] },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_quotes,
                    args: { id: PURCHASE_ID, items: [{ priceCode: "WEB-SHOP" }] },
                    answer: refused(DECLINED),
                },
            ],
            output: { ...PURCHASE, quote: null, declined: true },
        },
    ],
})
