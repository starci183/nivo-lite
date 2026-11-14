import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { crmOk } from "./books.fixtures"
import { idSchema } from "./books-shapes"

/** The state of a request whose money is awaited (the CRM's own state name, for renewals and purchases alike). */
const AWAITING_PAYMENT = "awaiting_payment"

/** The most rows one read lists (the CRM's open lists' own most). */
const LIST_MAX = 50

/** The CRM's open lists' args: the requests awaiting payment, as many as one read lists. */
const OPEN_ARGS = { state: AWAITING_PAYMENT, limit: LIST_MAX }

/** An open renewal request as `renewal.open.list` answers it: its payment code and its total, as the CRM computed them. */
const renewalRow = z.object({
    id: idSchema,
    customerCode: idSchema,
    serviceCode: idSchema,
    termMonths: z.number().int().min(1).max(120),
    paymentCode: z.string().max(20).nullable(),
    totalVnd: z.number().int().nullable(),
})

/** A purchase awaiting payment as `purchase.open.list` answers it (no payment code, no total: `purchase.get` holds them). */
const purchaseRow = z.object({ id: idSchema, code: z.string().max(12), customerCode: idSchema.nullable() })

/** A purchase as `purchase.get` answers it: the payment code and the quote's total. */
const purchaseDetail = z.object({
    id: idSchema,
    paymentCode: z.string().max(20).nullable(),
    quote: z.object({ totalVnd: z.number().int() }).nullable(),
})

const listOf = <T extends z.ZodType>(row: T) => z.object({ items: z.array(row).max(LIST_MAX) })

/** What the step hands on: every request awaiting money, each with the payment code and the total the CRM computed. */
const output = z.object({
    renewals: z.array(renewalRow).max(LIST_MAX),
    purchases: z
        .array(
            z.object({
                id: idSchema,
                code: z.string().max(12),
                customerCode: idSchema.nullable(),
                paymentCode: z.string().max(20).nullable(),
                totalVnd: z.number().int().nullable(),
            }),
        )
        .max(LIST_MAX),
})

const RENEWAL_ID = "5b0f3c1e-2d4a-4e6b-8c7d-9a0b1c2d3e4f"
const PURCHASE_ID = "7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f"

/** The open renewal request of the examples, as the CRM lists it. */
const RENEWAL_ROW = {
    id: RENEWAL_ID,
    serviceCode: "SITE1-HOST",
    customerCode: "KH-0001",
    provider: "manual",
    termMonths: 12,
    state: AWAITING_PAYMENT,
    netVnd: 1_100_000,
    vatVnd: 88_000,
    totalVnd: 1_188_000,
    priceSource: "price_sheet",
    paymentCode: "GH8K2Q",
    transactionRef: null,
    paidAt: null,
    dryRun: true,
    plugin: "manual",
    providerRef: null,
    newExpiresOn: null,
    confirmedBy: null,
    confirmedAt: null,
    createdAt: "2026-11-10T03:00:00.000Z",
}

/** The purchase awaiting payment of the examples, as the CRM's open list answers it. */
const PURCHASE_ROW = {
    id: PURCHASE_ID,
    code: "MUA-0007",
    state: AWAITING_PAYMENT,
    channel: "zalo",
    sourceRef: "c-0002",
    customerCode: "KH-0142",
    quotedOn: "2026-11-08",
    validUntil: "2026-11-22",
    lastFollowUpOn: null,
    followUpCount: 0,
    openFollowUp: false,
    reachable: true,
}

/** The same purchase as `purchase.get` answers it: its payment code and its quote's total. */
const PURCHASE_DETAIL = {
    ...PURCHASE_ROW,
    need: "Thiet ke website ban hang",
    contactName: "Anh Minh",
    phone: null,
    email: null,
    domain: "minhshop.vn",
    quote: {
        lines: [],
        netVnd: 5_000_000,
        vatRatePercent: 10,
        vatVnd: 500_000,
        totalVnd: 5_500_000,
        priceSource: "price_sheet",
        quotedOn: "2026-11-08",
        validUntil: "2026-11-22",
    },
    paymentCode: "MUA7Q2",
    transactionRef: null,
    paidAt: null,
    acceptedAt: "2026-11-09T02:00:00.000Z",
    projectCode: null,
    contractNo: null,
    note: null,
    followUps: [],
}

/**
 * `webbooks.payment-open` (Read the requests awaiting money): the CRM's open renewal requests and purchases awaiting payment, and each
 * purchase's payment code and quote total (`purchase.get`: the open list carries neither). Reads only, no model, no comparison: the
 * payment code and the total are the CRM's, copied as it answered them; the match is the next step's.
 */
export const webbooksPaymentOpenNode: TemplateNode = defineTemplateNode({
    id: "webbooks.payment-open",
    title: webbooksText("node.payment-open.title"),
    description: { vi: "\u0110\u1ecdc c\u00e1c y\u00eau c\u1ea7u gia h\u1ea1n v\u00e0 \u0111\u01a1n mua \u0111ang ch\u1edd kh\u00e1ch tr\u1ea3 ti\u1ec1n.", en: "Reads the renewal requests and purchases waiting for the customer's payment." },
    tools: [CRM_NIVOWEB.get_renewals_open, CRM_NIVOWEB.get_purchases_open, CRM_NIVOWEB.get_purchases_id],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input: z.object({}),
    output,
    run: async (_given, ctx) => {
        const renewalsAnswer = await ctx.tools.call(CRM_NIVOWEB.get_renewals_open, OPEN_ARGS)
        if (!renewalsAnswer.ok)
            return ctx.fail(
                { kind: "cannot", why: `renewal_list_refused:${renewalsAnswer.refusal}` },
                renewalsAnswer.facts,
            )
        const purchasesAnswer = await ctx.tools.call(CRM_NIVOWEB.get_purchases_open, OPEN_ARGS)
        if (!purchasesAnswer.ok)
            return ctx.fail(
                { kind: "cannot", why: `purchase_list_refused:${purchasesAnswer.refusal}` },
                purchasesAnswer.facts,
            )
        const purchases = []
        for (const row of listOf(purchaseRow).parse(purchasesAnswer.value).items) {
            const read = await ctx.tools.call(CRM_NIVOWEB.get_purchases_id, { id: row.id })
            if (!read.ok) return ctx.fail({ kind: "cannot", why: `purchase_read_refused:${read.refusal}` }, read.facts)
            const detail = purchaseDetail.parse(read.value)
            purchases.push({
                id: row.id,
                code: row.code,
                customerCode: row.customerCode,
                paymentCode: detail.paymentCode,
                totalVnd: detail.quote?.totalVnd ?? null,
            })
        }
        return { renewals: listOf(renewalRow).parse(renewalsAnswer.value).items, purchases }
    },
    examples: [
        {
            name: "lists the renewal requests and the purchases awaiting money, each with its payment code and total as the CRM holds them",
            params: {},
            input: {},
            tools: [
                { id: CRM_NIVOWEB.get_renewals_open, args: OPEN_ARGS, answer: crmOk({ items: [RENEWAL_ROW], nextCursor: null }) },
                { id: CRM_NIVOWEB.get_purchases_open, args: OPEN_ARGS, answer: crmOk({ items: [PURCHASE_ROW], nextCursor: null }) },
                { id: CRM_NIVOWEB.get_purchases_id, args: { id: PURCHASE_ID }, answer: crmOk(PURCHASE_DETAIL) },
            ],
            output: {
                renewals: [
                    {
                        id: RENEWAL_ID,
                        customerCode: "KH-0001",
                        serviceCode: "SITE1-HOST",
                        termMonths: 12,
                        paymentCode: "GH8K2Q",
                        totalVnd: 1_188_000,
                    },
                ],
                purchases: [
                    {
                        id: PURCHASE_ID,
                        code: "MUA-0007",
                        customerCode: "KH-0142",
                        paymentCode: "MUA7Q2",
                        totalVnd: 5_500_000,
                    },
                ],
            },
        },
        {
            name: "nothing awaits money: both lists are empty and nothing more is read",
            params: {},
            input: {},
            tools: [
                { id: CRM_NIVOWEB.get_renewals_open, args: OPEN_ARGS, answer: crmOk({ items: [], nextCursor: null }) },
                { id: CRM_NIVOWEB.get_purchases_open, args: OPEN_ARGS, answer: crmOk({ items: [], nextCursor: null }) },
            ],
            output: { renewals: [], purchases: [] },
        },
    ],
})
