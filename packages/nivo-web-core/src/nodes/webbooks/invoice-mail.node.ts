import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type ScriptedToolCall, type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { LINE_MAX, idSchema, localeSchema } from "./books-shapes"
import { crmOk, refused, mailSentOk } from "./books.fixtures"
import { customerMailSchema, mailArgsOf, sendCustomerMail } from "./customer-mail"
import { webbooksText } from "../../modules/webbooks/copy"

/**
 * The invoice really issued and whom it is for. The graph's `ifNode` passes only `dryRun` false with a number (and a declined draft
 * never reaches the issue), but a check does not narrow the ref: the number and the draft id are typed nullable here and the node
 * refuses a null one exactly.
 */
const input = z.object({
    renewalId: idSchema,
    customerCode: idSchema,
    draftId: idSchema.nullable(),
    invoiceNo: z.string().min(1).max(40).nullable(),
    locale: localeSchema,
})

/** What the agent writes: the mail, or none when the CRM gives the customer no e-mail. */
const answer = z.object({
    mail: customerMailSchema.describe("The invoice mail; null when the CRM gives the customer no e-mail."),
})

/** What became of the mail. */
const output = z.object({
    messageRef: idSchema.nullable().describe("The reference the mail send answered; null when no mail went."),
    refusal: z
        .string()
        .max(LINE_MAX)
        .nullable()
        .describe("The send's refusal (the person declined, the address bounced); null otherwise."),
})

/** The reads the agent may make: the customer and the invoice's draft (lines, totals). */
const READS = [CRM_NIVOWEB.get_customers_code, CRM_NIVOWEB.get_invoice_drafts_id]

const GOAL =
    "Write the mail that tells the customer their invoice was issued: read the customer and the invoice's draft, address it to the " +
    "customer's e-mail exactly as the CRM answered it, in the customer's language, with the invoice number as given and amounts only as " +
    "the draft answered them. When the CRM gives the customer no e-mail, write no mail."

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

const MAIL = {
    to: "ketoan@mau-a.example",
    subject: "Hoa don gia han hosting SITE1-HOST",
    body: "Kinh gui Cong ty Mau A, hoa don so 00000123 cho gia han hosting SITE1-HOST 12 thang, tong 1.188.000d, da duoc xuat.",
}

const ABOUT = { kind: "invoice", code: "00000123" } as const

const GIVEN = {
    renewalId: RENEWAL_ID,
    customerCode: "KH-0001",
    draftId: DRAFT_ID,
    invoiceNo: "00000123",
    locale: "vi",
} as const

const READ_CALLS: ReadonlyArray<ScriptedToolCall> = [
    { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-0001" }, answer: crmOk(CUSTOMER) },
    { id: CRM_NIVOWEB.get_invoice_drafts_id, args: { id: DRAFT_ID }, answer: crmOk(DRAFT) },
]

/**
 * `webbooks.invoice-mail` (Send the invoice to the customer): split from `webbooks.invoice-notify`, reached only for an invoice
 * really issued. The agent reads the customer and the draft and writes the mail; the node mails it with `TOOL.mailMessageSend`
 * (smtp, `auto`: the mail tool raises the draft a person edits and sends; it replaces the `send_email` work item), carrying the invoice number
 * as the record it is about. A refusal (a shop's own `ask` declined included) is answered as a fact. A side node (`blocking:
 * false`): without a sending mailbox the invoice is still issued and the team told.
 */
export const webbooksInvoiceMailNode: TemplateNode = defineTemplateNode({
    id: "webbooks.invoice-mail",
    title: webbooksText("node.invoice-mail.title"),
    description: { vi: "G\u1eedi ho\u00e1 \u0111\u01a1n \u0111\u00e3 xu\u1ea5t cho kh\u00e1ch qua th\u01b0.", en: "Mails the issued invoice to the customer." },
    tools: [...READS, TOOL.mailMessageSend],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER, PROVIDER.smtp],
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, ctx) => {
        const { invoiceNo } = given
        if (invoiceNo === null) return ctx.fail({ kind: "cannot", why: "invoice_without_number" })
        if (given.draftId === null) return ctx.fail({ kind: "cannot", why: "no_draft_named" })
        const written = await ctx.agent.run({ goal: GOAL, input: given, output: answer, maxTurns: 3, tools: READS })
        if (written.mail === null) return { messageRef: null, refusal: null }
        return sendCustomerMail(ctx, written.mail, { kind: "invoice", code: invoiceNo })
    },
    examples: [
        {
            name: "an issued invoice: the customer's mail, raised as a draft a person sends",
            params: {},
            input: GIVEN,
            agent: [{ answer: { mail: MAIL }, calls: READ_CALLS }],
            tools: [
                {
                    id: TOOL.mailMessageSend,
                    args: mailArgsOf(MAIL, ABOUT),
                    answer: mailSentOk({ emailMessageId: "mail-0002", status: "sent" }),
                },
            ],
            output: { messageRef: "mail-0002", refusal: null },
        },
        {
            name: "the person declines the mail: the refusal answered as a fact",
            params: {},
            input: GIVEN,
            agent: [{ answer: { mail: MAIL }, calls: READ_CALLS }],
            tools: [{ id: TOOL.mailMessageSend, args: mailArgsOf(MAIL, ABOUT), answer: refused("declined") }],
            output: { messageRef: null, refusal: "declined" },
        },
        {
            name: "no invoice number reached the step: nothing is written or mailed, the node cannot go on",
            params: {},
            input: { ...GIVEN, invoiceNo: null },
            failure: { kind: "cannot", why: "invoice_without_number" },
        },
        {
            name: "no draft reached the step: nothing is written or mailed, the node cannot go on",
            params: {},
            input: { ...GIVEN, draftId: null },
            failure: { kind: "cannot", why: "no_draft_named" },
        },
    ],
})
