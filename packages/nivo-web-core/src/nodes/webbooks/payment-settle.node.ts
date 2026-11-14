import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { type Exact, exactOf, onlyExactOf } from "../../rules/webbooks/payment-match"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { LINE_MAX, idSchema, localeSchema } from "./books-shapes"
import { TRUTHS_NOTICE, ownOk } from "./books.fixtures"

/** The most requests of each kind one match looks across (the open lists' own most). */
const LIST_MAX = 50

/** The credit and the requests awaiting money, as the two read steps before this one handed them on, and the team's language. */
const input = z.object({
    transactionRef: idSchema,
    amountVnd: z.number().int(),
    reference: z.string().max(400).nullable(),
    renewals: z
        .array(
            z.object({
                id: idSchema,
                customerCode: idSchema,
                serviceCode: idSchema,
                termMonths: z.number().int().min(1).max(120),
                paymentCode: z.string().max(20).nullable(),
                totalVnd: z.number().int().nullable(),
            }),
        )
        .max(LIST_MAX),
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
    locale: localeSchema.default("vi"),
})

type Given = z.output<typeof input>
type RenewalRow = Given["renewals"][number]
type PurchaseRow = Given["purchases"][number]

/** What the agent answers when the exact facts leave the credit open: the request a truth of the company makes it pay, and why. */
const judged = z.object({
    branch: z
        .enum(["renewal", "purchase"])
        .describe("renewal: the credit pays an open renewal request. purchase: a purchase awaiting payment."),
    requestId: idSchema.describe("The `id` of that request, exactly as listed."),
    reason: z
        .string()
        .min(1)
        .max(LINE_MAX)
        .describe(
            "One line in the team's language: which truth of the company makes this credit pay this request although the exact facts do not.",
        ),
})

/**
 * What the step answers, as the route the graph takes. `reason` is the agent's line when it judged; null when the exact facts
 * alone settled the credit (the team step words that case).
 */
const output = z
    .object({
        branch: z.enum(["renewal", "purchase"]),
        renewalId: idSchema.nullable(),
        purchaseId: idSchema.nullable(),
        purchaseCode: z
            .string()
            .max(12)
            .nullable()
            .describe("The purchase's `code`, as the CRM listed it; null on a renewal."),
        transactionRef: idSchema.describe("The `id` of the credit that pays it, as the credit list answered it."),
        customerCode: idSchema,
        serviceCode: idSchema.nullable(),
        termMonths: z.number().int().min(1).max(120).nullable(),
        reason: z.string().min(1).max(LINE_MAX).nullable(),
    })
    .refine(
        (answer) =>
            answer.branch !== "renewal" ||
            [answer.renewalId, answer.serviceCode, answer.termMonths].every((member) => member !== null),
        { message: "A renewal names the request, the service and the term.", path: ["branch"] },
    )
    .refine((answer) => answer.branch !== "purchase" || (answer.purchaseId !== null && answer.purchaseCode !== null), {
        message: "A purchase names the purchase and its code.",
        path: ["branch"],
    })

type SettleOutput = z.input<typeof output>

/** The reads the agent may make when it judges: the requests in full, a customer's balance (the company's truths are the default reads). */
const READS = [CRM_NIVOWEB.get_renewals_id, CRM_NIVOWEB.get_purchases_id, CRM_NIVOWEB.get_customers_code_balance]

const GOAL =
    "A bank credit arrived that pays no open request clearly: for each open renewal request and purchase awaiting payment you are given " +
    "whether the credit's transfer text holds its payment code (`named`) and whether the amount equals its total (`amountMatches`), " +
    "both checked exactly. Search the company's truths: only when a truth decides this case (for example a difference the company " +
    "accepts) answer the ONE request the credit pays, with the id as listed and the truth in one line. Anything else (no request or " +
    "several fit, the amount differs and no truth decides) is not clear: say you are confused, with the facts, so the founder decides. " +
    "You never write to the customer and never type an amount."

/** The output of a renewal the credit pays. */
const renewalOutput = (row: RenewalRow, transactionRef: string, reason: string | null): SettleOutput => ({
    branch: "renewal",
    renewalId: row.id,
    purchaseId: null,
    purchaseCode: null,
    transactionRef,
    customerCode: row.customerCode,
    serviceCode: row.serviceCode,
    termMonths: row.termMonths,
    reason,
})

/** The output of a purchase the credit pays (its customer is known: checked by the caller). */
const purchaseOutput = (
    row: PurchaseRow & { readonly customerCode: string },
    transactionRef: string,
    reason: string | null,
): SettleOutput => ({
    branch: "purchase",
    renewalId: null,
    purchaseId: row.id,
    purchaseCode: row.code,
    transactionRef,
    customerCode: row.customerCode,
    serviceCode: null,
    termMonths: null,
    reason,
})

// The worked examples' records.

const RENEWAL_ID = "5b0f3c1e-2d4a-4e6b-8c7d-9a0b1c2d3e4f"
const PURCHASE_ID = "7c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f"

const RENEWAL_ROW: RenewalRow = {
    id: RENEWAL_ID,
    customerCode: "KH-0001",
    serviceCode: "SITE1-HOST",
    termMonths: 12,
    paymentCode: "GH8K2Q",
    totalVnd: 1_188_000,
}
const PURCHASE_ROW: PurchaseRow = {
    id: PURCHASE_ID,
    code: "MUA-0007",
    customerCode: "KH-0142",
    paymentCode: "MUA7Q2",
    totalVnd: 5_500_000,
}

const GIVEN = { locale: "vi", renewals: [RENEWAL_ROW], purchases: [PURCHASE_ROW] }

const FEE_TRUTH = {
    notice: TRUTHS_NOTICE,
    facts: [
        { id: "f-fee", text: "Khach chuyen thieu dung 11.000d phi chuyen khoan lien ngan hang thi van ghi nhan du." },
    ],
}
const FEE_REASON = "tx-0078 ghi ma GH8K2Q, thieu 11.000d dung phi chuyen khoan; quy dinh cong ty ghi nhan du."
const CONFUSED_QUESTION =
    "tx-0078 ghi ma GH8K2Q nhung thieu 11.000d so voi tong 1.188.000d: ghi nhan da tra hay cho khach chuyen them?"

/**
 * `webbooks.payment-settle` (Match money to the request awaiting payment): the credit (`payment-credit`) against the requests awaiting
 * money (`payment-open`), converted in place; it reads no tool of its own and writes nothing. The CRM does not answer whether a credit
 * pays a request, so the step compares EXACTLY, with the pure rule `rules/webbooks/payment-match` (the payment code held in the
 * transfer text, the amount equal to the total: identifiers and numbers, never a word read for meaning). Exactly one request with both is
 * settled from those facts alone, with no AI. Anything else goes to the agent with every row and its facts; it may only apply a truth
 * of the company to the case, otherwise it fails confused by itself and the engine asks the founder. Routes `renewal` / `purchase`;
 * every id and code is copied from the rows it was given, never from the model. A purchase with no CRM customer cannot be settled (the
 * hand-off to Sales names one): the step says so.
 */
export const webbooksPaymentSettleNode: TemplateNode = defineTemplateNode({
    id: "webbooks.payment-settle",
    title: webbooksText("node.payment-settle.title"),
    description: { vi: "Kh\u1edbp kho\u1ea3n ti\u1ec1n nh\u1eadn \u0111\u01b0\u1ee3c v\u1edbi y\u00eau c\u1ea7u \u0111ang ch\u1edd tr\u1ea3 theo m\u00e3 thanh to\u00e1n v\u00e0 s\u1ed1 ti\u1ec1n; tr\u01b0\u1eddng h\u1ee3p kh\u00f4ng r\u00f5 th\u00ec h\u1ecfi ch\u1ee7.", en: "Matches the money received to the request waiting for payment by payment code and amount; asks the owner when it is unclear." },
    tools: READS,
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    model: "claude-sonnet-5-5",
    routes: { by: "branch", names: ["renewal", "purchase"] },
    sensitive: { reason: "pii" },
    run: async (given, ctx) => {
        const credit = { id: given.transactionRef, amountVnd: given.amountVnd, reference: given.reference }
        const renewals = given.renewals.map((row) => ({ row, exact: exactOf(credit, row) }))
        const purchases = given.purchases.map((row) => ({ row, exact: exactOf(credit, row) }))

        const settledPurchase = (row: PurchaseRow, reason: string | null): SettleOutput => {
            const { customerCode } = row
            if (customerCode === null)
                return ctx.fail({ kind: "cannot", why: "purchase_without_customer" }, { purchaseId: row.id })
            return purchaseOutput({ ...row, customerCode }, credit.id, reason)
        }
        const exactRows: ReadonlyArray<{ readonly kind: "renewal" | "purchase"; readonly id: string; readonly exact: Exact }> = [
            ...renewals.map((one) => ({ kind: "renewal" as const, id: one.row.id, exact: one.exact })),
            ...purchases.map((one) => ({ kind: "purchase" as const, id: one.row.id, exact: one.exact })),
        ]
        const only = onlyExactOf(exactRows)
        if (only !== null) {
            const renewal = renewals.find((one) => only.kind === "renewal" && one.row.id === only.id)
            if (renewal !== undefined) return renewalOutput(renewal.row, credit.id, null)
            const purchase = purchases.find((one) => only.kind === "purchase" && one.row.id === only.id)
            if (purchase !== undefined) return settledPurchase(purchase.row, null)
        }

        const decided = await ctx.agent.run({
            goal: GOAL,
            input: {
                credit,
                renewals: renewals.map((one) => ({ ...one.row, ...one.exact })),
                purchases: purchases.map((one) => ({ ...one.row, ...one.exact })),
                locale: given.locale,
            },
            output: judged,
            maxTurns: 6,
            tools: READS,
        })
        const renewal =
            decided.branch === "renewal" ? renewals.find((one) => one.row.id === decided.requestId) : undefined
        const purchase =
            decided.branch === "purchase" ? purchases.find((one) => one.row.id === decided.requestId) : undefined
        if (renewal !== undefined) return renewalOutput(renewal.row, credit.id, decided.reason)
        if (purchase !== undefined) return settledPurchase(purchase.row, decided.reason)
        return ctx.fail(
            { kind: "cannot", why: "request_not_open" },
            { requestId: decided.requestId, branch: decided.branch },
        )
    },
    examples: [
        {
            name: "the credit holds the renewal request's code with its exact total and no purchase fits: renewal, no AI, ids copied",
            params: {},
            input: { ...GIVEN, transactionRef: "tx-0077", amountVnd: 1_188_000, reference: "GH8K2Q chuyen tien gia han" },
            output: {
                branch: "renewal",
                renewalId: RENEWAL_ID,
                purchaseId: null,
                purchaseCode: null,
                transactionRef: "tx-0077",
                customerCode: "KH-0001",
                serviceCode: "SITE1-HOST",
                termMonths: 12,
                reason: null,
            },
        },
        {
            name: "the credit holds the purchase's code with its quote's exact total and no renewal fits: purchase, no AI, ids copied",
            params: {},
            input: { ...GIVEN, transactionRef: "tx-0090", amountVnd: 5_500_000, reference: "MUA7Q2 thanh toan website" },
            output: {
                branch: "purchase",
                renewalId: null,
                purchaseId: PURCHASE_ID,
                purchaseCode: "MUA-0007",
                transactionRef: "tx-0090",
                customerCode: "KH-0142",
                serviceCode: null,
                termMonths: null,
                reason: null,
            },
        },
        {
            name: "the code is held but the amount differs and a truth of the company accepts the difference: the agent judges, renewal",
            params: {},
            input: { ...GIVEN, transactionRef: "tx-0078", amountVnd: 1_177_000, reference: "GH8K2Q chuyen tien gia han" },
            agent: [
                {
                    answer: { branch: "renewal", requestId: RENEWAL_ID, reason: FEE_REASON },
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: "chenh lech phi chuyen khoan" },
                            answer: ownOk(FEE_TRUTH),
                        },
                    ],
                },
            ],
            output: {
                branch: "renewal",
                renewalId: RENEWAL_ID,
                purchaseId: null,
                purchaseCode: null,
                transactionRef: "tx-0078",
                customerCode: "KH-0001",
                serviceCode: "SITE1-HOST",
                termMonths: 12,
                reason: FEE_REASON,
            },
        },
        {
            name: "the code is held, the amount differs and no truth decides: the agent is confused, the founder decides",
            params: {},
            input: { ...GIVEN, transactionRef: "tx-0078", amountVnd: 1_177_000, reference: "GH8K2Q chuyen tien gia han" },
            // the model's truths search that found nothing, before it gives up
            agent: [
                {
                    fail: { kind: "confused", question: CONFUSED_QUESTION },
                    calls: [
                        {
                            id: TOOL.brainSearch,
                            args: { query: "chenh lech phi chuyen khoan" },
                            answer: ownOk({ notice: TRUTHS_NOTICE, facts: [] }),
                        },
                    ],
                },
            ],
            failure: { kind: "confused", question: CONFUSED_QUESTION },
        },
        {
            name: "two requests fit the credit exactly: not clear, the agent is confused and the founder decides",
            params: {},
            input: {
                ...GIVEN,
                transactionRef: "tx-0079",
                amountVnd: 1_188_000,
                reference: "GH8K2Q chuyen tien gia han",
                renewals: [RENEWAL_ROW, { ...RENEWAL_ROW, id: "9d2e3f4a-5b6c-4d7e-8f90-1a2b3c4d5e6f", serviceCode: "SITE2-HOST" }],
            },
            agent: [{ fail: { kind: "confused", question: CONFUSED_QUESTION }, calls: [] }],
            failure: { kind: "confused", question: CONFUSED_QUESTION },
        },
    ],
})
