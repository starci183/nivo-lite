import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { type ScriptedToolCall, type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { LINE_MAX, idSchema } from "./books-shapes"
import { crmOk, refused, mailSentOk } from "./books.fixtures"
import { customerMailSchema, mailArgsOf, sendCustomerMail } from "./customer-mail"
import { DUE_EXAMPLE } from "./due.node"
import { noticeItemSchema } from "./notice-team.node"
import { webbooksText } from "../../modules/webbooks/copy"

/** What the agent answers: the notice to mail now, or none (the truths say not now, or the CRM gives no e-mail), and why. */
const answer = z.object({
    mail: customerMailSchema.describe(
        "The customer notice to mail now; null when the truths say the customer is not told now, or the CRM gives no e-mail.",
    ),
    why: z
        .string()
        .min(1)
        .max(LINE_MAX)
        .describe("One line in the team's language: what you drafted for the customer, or why nothing."),
})

/** What the step did: the mail's reference when it went, the refusal when the send refused, and the agent's line. */
const output = z.object({
    projectCode: idSchema,
    messageRef: idSchema.nullable().describe("The reference the mail send answered; null when no mail went."),
    refusal: z
        .string()
        .max(LINE_MAX)
        .nullable()
        .describe("The send's refusal (the person declined, the address bounced); null otherwise."),
    why: z.string().min(1).max(LINE_MAX),
})

/**
 * The reads the agent may make: the customer, what is open, the company's truths (notice wording, terms, when the customer is
 * told).
 */
const READS = [CRM_NIVOWEB.get_customers_code, CRM_NIVOWEB.get_customers_code_balance]

const GOAL =
    "Decide by the company's truths whether the customer of this due project receivable is told now, and if so write the notice: read " +
    "the customer and what is open, address it to the customer's e-mail exactly as the CRM answered it, in the customer's language, and " +
    "quote an amount only as a CRM read answered it. When the truths say not now, or the CRM gives the customer no e-mail, write no mail " +
    "and say why in one line for the team."

const CUSTOMER = {
    code: "KH-0002",
    name: "Cong ty Mau B",
    taxId: "0100000002",
    phone: null,
    email: "ketoan@mau-b.example",
    reachable: true,
    contacts: [],
}

const BALANCE = { customerCode: "KH-0002", ledger131: null, openReceivables: [], openRemainingVnd: 10_000_000 }

const MAIL = {
    to: "ketoan@mau-b.example",
    subject: "Nhac thanh toan dot 2 hop dong HD-02",
    body: "Kinh gui Cong ty Mau B, dot thanh toan cua hop dong HD-02 den han ngay 30/10/2026, con lai 10.000.000d.",
}

const ABOUT = { kind: "project", code: "SITE2-WEB" } as const

const WHY = "Soan thu nhac cho khach, cho nguoi duyet gui."

/** The reads of the worked examples, in the order the agent makes them. */
const READ_CALLS: ReadonlyArray<ScriptedToolCall> = [
    { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-0002" }, answer: crmOk(CUSTOMER) },
    { id: CRM_NIVOWEB.get_customers_code_balance, args: { code: "KH-0002" }, answer: crmOk(BALANCE) },
]

/**
 * `webbooks.notice-draft` (Draft the customer notice): split from `webbooks.notice`, the second body step of the receivable
 * round. The agent reads the customer and the truths and writes the notice, or decides none (ADDENDUM 10); the node mails it with
 * `TOOL.mailMessageSend` (smtp, mode `ask`: the mail goes once a person approves it on the card, MXW-1; it replaces the `send_email` work item),
 * carrying the project code as the record it is about. A refusal of the send (a shop's own `ask` declined included) is read in code
 * and answered as a fact: no reference, so the graph records no notice. A side node (`blocking: false`): without a sending mailbox the
 * round still tells the team and reports.
 */
export const webbooksNoticeDraftNode: TemplateNode = defineTemplateNode({
    id: "webbooks.notice-draft",
    title: webbooksText("node.notice-draft.title"),
    description: { vi: "So\u1ea1n th\u01b0 nh\u1eafc n\u1ee3 cho kh\u00e1ch c\u00f3 kho\u1ea3n qu\u00e1 h\u1ea1n \u0111\u1ec3 ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch duy\u1ec7t r\u1ed3i g\u1eedi.", en: "Drafts the overdue-payment reminder for the customer for the owner to approve and send." },
    tools: [...READS, TOOL.mailMessageSend],
    // R83 (owner, interim; the CEO reviews later): AI-written mail about money or a commitment asks, a person approves the whole
    // message on the approval card before it goes (`ask`), as the package's own words ("a draft a person sends") say.
    mode: "ask",
    accounts: [CRM_NIVOWEB_PROVIDER, PROVIDER.smtp],
    input: noticeItemSchema,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    sensitive: { why: "pii", refusal: "pii" },
    run: async (given, ctx) => {
        const decided = await ctx.agent.run({ goal: GOAL, input: given, output: answer, maxTurns: 5, tools: READS })
        if (decided.mail === null)
            return { projectCode: given.projectCode, messageRef: null, refusal: null, why: decided.why }
        const sent = await sendCustomerMail(ctx, decided.mail, { kind: "project", code: given.projectCode })
        return { projectCode: given.projectCode, ...sent, why: decided.why }
    },
    examples: [
        {
            name: "reads the customer and what is open, writes the notice, the mail tool raises the draft a person sends",
            params: {},
            input: { ...DUE_EXAMPLE, locale: "vi" },
            agent: [{ answer: { mail: MAIL, why: WHY }, calls: READ_CALLS }],
            tools: [
                {
                    id: TOOL.mailMessageSend,
                    args: mailArgsOf(MAIL, ABOUT),
                    answer: mailSentOk({ emailMessageId: "mail-0001", status: "sent" }),
                },
            ],
            output: { projectCode: "SITE2-WEB", messageRef: "mail-0001", refusal: null, why: WHY },
        },
        {
            name: "the person declines the mail: no reference, the refusal answered as a fact (the graph records no notice)",
            params: {},
            input: { ...DUE_EXAMPLE, locale: "vi" },
            agent: [{ answer: { mail: MAIL, why: WHY }, calls: READ_CALLS }],
            tools: [{ id: TOOL.mailMessageSend, args: mailArgsOf(MAIL, ABOUT), answer: refused("declined") }],
            output: { projectCode: "SITE2-WEB", messageRef: null, refusal: "declined", why: WHY },
        },
        {
            name: "the CRM gives the customer no e-mail: no mail, the reason for the team",
            params: {},
            input: { ...DUE_EXAMPLE, locale: "vi" },
            agent: [
                {
                    answer: { mail: null, why: "CRM khong co email cua khach, chua soan thu." },
                    calls: [
                        { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-0002" }, answer: crmOk({ ...CUSTOMER, email: null }) },
                    ],
                },
            ],
            output: {
                projectCode: "SITE2-WEB",
                messageRef: null,
                refusal: null,
                why: "CRM khong co email cua khach, chua soan thu.",
            },
        },
    ],
})
