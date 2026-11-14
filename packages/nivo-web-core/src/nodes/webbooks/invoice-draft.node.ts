import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksText } from "../../modules/webbooks/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { LINE_MAX, idSchema, jsonText, localeSchema } from "./books-shapes"
import { TRUTHS_NOTICE, crmOk, ownOk, refused } from "./books.fixtures"

/** The renewal the invoice is for, as the renewal hand-off passes it. */
const input = z.object({
    renewalId: idSchema,
    customerCode: idSchema,
    serviceCode: idSchema,
    termMonths: z.number().int().min(1).max(120),
    locale: localeSchema,
})

/** What the agent writes once it read the buyer and the truths: one line for the owner who signs the issue. */
const answer = z.object({
    summary: z
        .string()
        .min(1)
        .max(LINE_MAX)
        .describe(
            "One line in the team's language: the buyer (name, tax id), the service and the term. No amount: the CRM computes them.",
        ),
})

/**
 * The draft the CRM opened, by id, with its totals copied from the CRM's answer, and the agent's line; or, when a person declined the
 * draft (`declined` true: a decision, the graph tells the team and ends `declined`), no draft: its members null.
 */
const output = z.object({
    draftId: idSchema.nullable().describe("The draft's `id` exactly as the CRM answered it; null when declined."),
    renewalId: idSchema,
    netVnd: z.number().int().nonnegative().nullable().describe("The draft's net total, as the CRM answered it."),
    vatVnd: z.number().int().nonnegative().nullable().describe("The draft's VAT, as the CRM answered it."),
    totalVnd: z.number().int().nonnegative().nullable().describe("The draft's total, as the CRM answered it."),
    summary: z.string().min(1).max(LINE_MAX),
    declined: z.boolean().describe("True when a person declined the draft."),
})

/** The reads the agent may make: the buyer, the company's truths on when and how an invoice is issued. */
const READS = [CRM_NIVOWEB.get_customers_code]

const GOAL =
    "Check that this paid renewal is to be invoiced now: read the buyer (an invoice needs the name, the tax id and the address) and the " +
    "company's truths on when and how an invoice is issued. When a truth says this renewal gets no invoice, or the buyer lacks what an " +
    "invoice needs, you cannot answer: say you are confused, with the facts, so the founder decides. Otherwise write one line for the " +
    "owner who signs the issue."

const RENEWAL_ID = "5b0f3c1e-2d4a-4e6b-8c7d-9a0b1c2d3e4f"
const DRAFT_ID = "6c1a4d2f-3e5b-4f7c-9d8e-0b1c2d3e4f5a"

const CUSTOMER = {
    code: "KH-0001",
    name: "Cong ty Mau A",
    taxId: "0100000001",
    phone: null,
    email: "ketoan@mau-a.example",
    reachable: true,
    contacts: [],
}

const DRAFT = {
    id: DRAFT_ID,
    state: "draft",
    renewalId: RENEWAL_ID,
    purchaseId: null,
    customerCode: "KH-0001",
    lines: [
        {
            description: "Gia han hosting SITE1-HOST 12 thang",
            quantity: 1,
            unitPriceVnd: 1_100_000,
            amountVnd: 1_100_000,
        },
    ],
    netVnd: 1_100_000,
    vatRatePercent: 8,
    vatVnd: 88_000,
    totalVnd: 1_188_000,
    priceSource: "placeholder",
}

/** The agent's read of the buyer in the worked examples. */
const READ_CUSTOMER = { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-0001" }, answer: crmOk(CUSTOMER) } as const

/** The truth of the confused example: this customer takes no VAT invoice. */
const NO_INVOICE = { notice: TRUTHS_NOTICE, facts: [{ id: "f-no-vat", text: "KH-0001 khong lay hoa don VAT." }] }

const SUMMARY = "Cong ty Mau A (MST 0100000001) - hosting SITE1-HOST 12 thang."

const GIVEN = {
    renewalId: RENEWAL_ID,
    customerCode: "KH-0001",
    serviceCode: "SITE1-HOST",
    termMonths: 12,
    locale: "vi",
} as const

/** The integer total `member` of a CRM draft answer. */
const vndOf = (draft: Readonly<Record<string, unknown>>, member: string): number => Number(draft[member])

/**
 * `webbooks.invoice-draft` (Draft the invoice), converted in place: the agent checks the buyer and the company's invoice truths
 * (reads only); the node opens the CRM's draft (`invoice.draft.create`, by the renewal id alone: the CRM computes the
 * lines, VAT and totals) and copies the totals from the CRM's answer, so no amount is ever typed by the model. The draft issues
 * nothing. Idempotent in the CRM: one draft per renewal. A person who declines the draft made a decision: the node returns it
 * (`declined` true, no draft) and the graph tells the team and ends `declined`. Any other refusal of the draft is a fact the node
 * cannot go past. Blocking: the draft is the graph's business.
 */
export const webbooksInvoiceDraftNode: TemplateNode = defineTemplateNode({
    id: "webbooks.invoice-draft",
    title: webbooksText("node.invoice-draft.title"),
    description: { vi: "Ki\u1ec3m tra ng\u01b0\u1eddi mua r\u1ed3i m\u1edf ho\u00e1 \u0111\u01a1n nh\u00e1p cho y\u00eau c\u1ea7u gia h\u1ea1n; ch\u01b0a xu\u1ea5t ho\u00e1 \u0111\u01a1n.", en: "Checks the buyer and opens the invoice draft for a renewal request; nothing is issued yet." },
    tools: [...READS, CRM_NIVOWEB.post_invoice_drafts],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    model: "claude-sonnet-5-5",
    sensitive: { summary: "pii" },
    run: async (given, ctx) => {
        const checked = await ctx.agent.run({ goal: GOAL, input: given, output: answer, maxTurns: 4, tools: READS })
        const opened = await ctx.tools.call(CRM_NIVOWEB.post_invoice_drafts, { renewalId: given.renewalId })
        if (!opened.ok && opened.declined === true)
            return {
                draftId: null,
                renewalId: given.renewalId,
                netVnd: null,
                vatVnd: null,
                totalVnd: null,
                summary: checked.summary,
                declined: true,
            }
        if (!opened.ok)
            return ctx.fail({ kind: "cannot", why: `invoice_draft_refused:${opened.refusal}` }, opened.facts)
        const draft = opened.value
        return {
            draftId: jsonText(draft["id"]),
            renewalId: given.renewalId,
            netVnd: vndOf(draft, "netVnd"),
            vatVnd: vndOf(draft, "vatVnd"),
            totalVnd: vndOf(draft, "totalVnd"),
            summary: checked.summary,
            declined: false,
        }
    },
    examples: [
        {
            name: "reads the buyer, opens the CRM's draft for the renewal and copies its totals",
            params: {},
            input: GIVEN,
            agent: [{ answer: { summary: SUMMARY }, calls: [READ_CUSTOMER] }],
            tools: [{ id: CRM_NIVOWEB.post_invoice_drafts, args: { renewalId: RENEWAL_ID }, answer: crmOk(DRAFT) }],
            output: {
                draftId: DRAFT_ID,
                renewalId: RENEWAL_ID,
                netVnd: 1_100_000,
                vatVnd: 88_000,
                totalVnd: 1_188_000,
                summary: SUMMARY,
                declined: false,
            },
        },
        {
            name: "a truth says this renewal gets no invoice: the agent is confused, no draft is opened",
            params: {},
            input: GIVEN,
            // the model's reads of the buyer and of the truth before it gives up
            agent: [
                {
                    fail: {
                        kind: "confused",
                        question: "KH-0001 khong lay hoa don VAT: co mo nhap hoa don cho lan gia han nay?",
                    },
                    calls: [
                        READ_CUSTOMER,
                        {
                            id: TOOL.brainSearch,
                            args: { query: "xuat hoa don gia han KH-0001" },
                            answer: ownOk(NO_INVOICE),
                        },
                    ],
                },
            ],
            failure: {
                kind: "confused",
                question: "KH-0001 khong lay hoa don VAT: co mo nhap hoa don cho lan gia han nay?",
            },
        },
        {
            name: "the CRM refuses the draft: the node cannot go on",
            params: {},
            input: GIVEN,
            agent: [{ answer: { summary: SUMMARY }, calls: [READ_CUSTOMER] }],
            tools: [
                { id: CRM_NIVOWEB.post_invoice_drafts, args: { renewalId: RENEWAL_ID }, answer: refused("renewal_not_paid") },
            ],
            failure: { kind: "cannot", why: "invoice_draft_refused:renewal_not_paid" },
        },
        {
            name: "a person declines the draft: none is opened, declined returned (the graph tells the team, ends declined)",
            params: {},
            input: GIVEN,
            agent: [{ answer: { summary: SUMMARY }, calls: [READ_CUSTOMER] }],
            tools: [{ id: CRM_NIVOWEB.post_invoice_drafts, args: { renewalId: RENEWAL_ID }, answer: refused("declined") }],
            output: {
                draftId: null,
                renewalId: RENEWAL_ID,
                netVnd: null,
                vatVnd: null,
                totalVnd: null,
                summary: SUMMARY,
                declined: true,
            },
        },
    ],
})
