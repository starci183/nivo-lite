import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import {
    refused,
    RENEWAL_ID,
    ZALO,
    crmAnswered,
    customerOf,
    draftedVia,
    sentOn,
    truthsAnswer,
} from "./webrenew.examples"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { type AnswerSource, optionalCustomer, optionalId } from "./answer-shapes"
import { type OpenedQuote, type QuoteOpenOutput, openedOf, quoteOpenOutputSchema } from "./quote-open.node"
import {
    ANSWER_SERVICES_MAX,
    ID_MAX,
    type LoopOutput,
    channelSchema,
    localeSchema,
    loopOutputSchema,
} from "./renew-shapes"
import {
    type CustomerReach,
    MAIL_CHANNEL,
    formOf,
    isDeclined,
    reachOfCustomer,
    reachOfIds,
    tellCustomer,
    toldOf,
    wordsSchemaOf,
} from "./webrenew.calls"
import { webrenewText } from "../../modules/webrenew/copy"

/** The customer, the requests the loop opened, and where the customer said yes. */
type QuoteTellInput = AnswerSource & {
    readonly customerCode: string | null
    readonly quotes: LoopOutput<QuoteOpenOutput>
}

/** What the step told: the requests named and their services, the channel the send went through, the message it answered. */
type QuoteTellOutput = {
    /**
     * True when a person declined: the quote's send, or every request the customer agreed to (nothing left to tell). The graph's
     * `declined` branch: the team is told, the run ends `declined`.
     */
    readonly declined: boolean
    readonly renewalIds: ReadonlyArray<string>
    /** The service of each request told, in the same order: what the graph records a quote on. */
    readonly serviceCodes: ReadonlyArray<string>
    readonly channel: string | null
    readonly messageRef: string | null
}

const ID = "webrenew.quote-tell"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<QuoteTellInput> = z.object({
    customerCode: optionalCustomer,
    quotes: loopOutputSchema(quoteOpenOutputSchema),
    conversationId: optionalId,
    contactId: optionalId,
    locale: localeSchema,
})
const output: z.ZodType<QuoteTellOutput> = z.object({
    declined: z.boolean(),
    renewalIds: z.array(z.uuid()).max(ANSWER_SERVICES_MAX),
    serviceCodes: z.array(z.string().min(1).max(120)).max(ANSWER_SERVICES_MAX),
    channel: channelSchema,
    messageRef: z.string().min(1).max(ID_MAX).nullable(),
})

const GOAL =
    "The customer agreed to renew: tell them the quote and ask them to pay first, in ONE message of the given `form`. Name each " +
    "request's total and payment code EXACTLY as `quotes` gives them; search the truths for the bank details and the transfer wording, " +
    "and say how to pay. Never type an amount or a code of your own; promise nothing else. Write the words only: the step sends them."

const QUOTE: QuoteOpenOutput = {
    declined: false,
    renewalId: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    totalVnd: 440_000,
    paymentCode: "GH12345",
}

const BANK = truthsAnswer([
    { id: "f-bank-1", text: "Chuyen khoan vao tai khoan cong ty, noi dung ghi dung ma thanh toan." },
])

const TEXT =
    "Da em gui anh bao gia gia han ten mien example.vn 12 thang: 440.000d (da gom VAT). Anh chuyen khoan vao tai khoan cong ty, noi dung ghi GH12345. Em gia han ngay khi nhan duoc tien a."

const SUBJECT = "Bao gia gia han ten mien example.vn"

/**
 * `webrenew.quote-tell` (Tell the quote and ask for the payment): after the loop opened the requests, the step tells the customer
 * the totals and payment codes exactly as the CRM answered them, with the bank details from the truths. The reach is the data's:
 * the conversation the answer came in, else the lead, else the CRM customer's contact read here (a lead contact, else a mail
 * address, the mail raised as a draft a person sends, carrying the first request it quotes as its `ref`). The agent writes the words;
 * the step sends them (by itself, mode `auto`; the mail is a draft a person sends). With no request opened, or no way to reach the customer, or a refused send, the run stops
 * (the engine reports it): no holding line is sent. A person's decline is a decision, never a failure: when they declined the
 * quote's send, or every request (none opened, at least one declined), the step RETURNS `declined` true and the graph tells the
 * team and ends `declined`. It answers the services it told, which the graph records the quote on.
 */
export const webrenewQuoteTellNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.quoteTell.title"),
    description: { vi: "B\u00e1o kh\u00e1ch t\u1ed5ng ti\u1ec1n v\u00e0 m\u00e3 thanh to\u00e1n c\u1ee7a c\u00e1c y\u00eau c\u1ea7u gia h\u1ea1n, k\u00e8m th\u00f4ng tin ng\u00e2n h\u00e0ng, v\u00e0 nh\u1edd kh\u00e1ch thanh to\u00e1n.", en: "Tells the customer the totals and payment codes of the renewal requests, with the bank details, and asks them to pay." },
    tools: [CRM_NIVOWEB.get_customers_code, TOOL.customerMessageSend, TOOL.mailMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta, PROVIDER.smtp, CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const left = given.quotes.items.flatMap((item) => (item.output === null ? [] : [item.output]))
        const quotes = left.flatMap((one): ReadonlyArray<OpenedQuote> => {
            const opened = openedOf(one)
            return opened === null ? [] : [opened]
        })
        if (quotes.length === 0 && left.some((one) => one.declined)) {
            return { declined: true, renewalIds: [], serviceCodes: [], channel: null, messageRef: null }
        }
        if (quotes.length === 0) return context.fail({ kind: "cannot", why: "no_request_opened" })
        const reachOfCrm = async (code: string | null): Promise<CustomerReach | null> => {
            if (code === null) return null
            const customer = await context.tools.call(CRM_NIVOWEB.get_customers_code, { code })
            if (!customer.ok)
                return context.fail(
                    { kind: "cannot", why: `customer_read_refused:${customer.refusal}` },
                    customer.facts,
                )
            return reachOfCustomer(customer.value)
        }
        const reach = reachOfIds(given.conversationId, given.contactId) ?? (await reachOfCrm(given.customerCode))
        if (reach === null) return context.fail({ kind: "cannot", why: "customer_unreachable" })
        const form = formOf(reach)
        const words = await context.agent.run({
            goal: GOAL,
            input: { quotes, form, locale: given.locale },
            output: wordsSchemaOf(form),
            tools: [],
            maxTurns: 4,
        })
        const [first] = quotes
        const sent = await tellCustomer(
            context,
            reach,
            words,
            first === undefined ? null : { kind: "renewal", code: first.renewalId },
        )
        const renewalIds = quotes.map((quote) => quote.renewalId)
        const serviceCodes = quotes.map((quote) => quote.serviceCode)
        if (isDeclined(sent)) return { declined: true, renewalIds, serviceCodes, channel: null, messageRef: null }
        if (!sent.ok) return context.fail({ kind: "cannot", why: `quote_send_refused:${sent.refusal}` }, sent.facts)
        return {
            declined: false,
            renewalIds: quotes.map((quote) => quote.renewalId),
            serviceCodes: quotes.map((quote) => quote.serviceCode),
            ...toldOf(reach, sent),
        }
    },
    examples: [
        {
            name: "tells the customer the CRM's total and payment code in their conversation",
            params: {},
            input: {
                customerCode: "KH-001",
                quotes: { items: [{ key: "0", output: QUOTE }], held: null },
                conversationId: "c1",
                contactId: null,
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: TEXT },
                    answer: sentOn(ZALO, "msg-2", "c1"),
                },
            ],
            // the agent's own read
            agent: [
                {
                    answer: { subject: null, text: TEXT },
                    calls: [{ id: TOOL.brainSearch, args: { query: "thong tin chuyen khoan" }, answer: BANK }],
                },
            ],
            output: {
                declined: false,
                renewalIds: [RENEWAL_ID],
                serviceCodes: ["EXAMPLE-TM"],
                channel: ZALO,
                messageRef: "msg-2",
            },
        },
        {
            name: "with no conversation and no person, a customer known only by mail gets a mail draft a person sends",
            params: {},
            input: {
                customerCode: "KH-001",
                quotes: { items: [{ key: "0", output: QUOTE }], held: null },
                conversationId: null,
                contactId: null,
                locale: "vi",
            },
            tools: [
                { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-001" }, answer: crmAnswered(customerOf([])) },
                {
                    id: TOOL.mailMessageSend,
                    args: {
                        to: "lienhe@example.vn",
                        subject: SUBJECT,
                        body: TEXT,
                        ref: { kind: "renewal", code: RENEWAL_ID },
                    },
                    answer: draftedVia(PROVIDER.smtp, "draft-2"),
                },
            ],
            agent: [
                {
                    answer: { subject: SUBJECT, text: TEXT },
                    calls: [{ id: TOOL.brainSearch, args: { query: "thong tin chuyen khoan" }, answer: BANK }],
                },
            ],
            output: {
                declined: false,
                renewalIds: [RENEWAL_ID],
                serviceCodes: ["EXAMPLE-TM"],
                channel: MAIL_CHANNEL,
                messageRef: "draft-2",
            },
        },
        {
            name: "no request opened: nothing is told and the run stops",
            params: {},
            input: {
                customerCode: "KH-001",
                quotes: { items: [], held: null },
                conversationId: "c1",
                contactId: null,
                locale: "vi",
            },
            failure: { kind: "cannot", why: "no_request_opened" },
        },
        {
            name: "a refused send stops the run, never tried another way",
            params: {},
            input: {
                customerCode: "KH-001",
                quotes: { items: [{ key: "0", output: QUOTE }], held: null },
                conversationId: "c1",
                contactId: null,
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: TEXT },
                    answer: refused("outside_window"),
                },
            ],
            agent: [
                {
                    answer: { subject: null, text: TEXT },
                    calls: [{ id: TOOL.brainSearch, args: { query: "thong tin chuyen khoan" }, answer: BANK }],
                },
            ],
            failure: { kind: "cannot", why: "quote_send_refused:outside_window" },
        },
        {
            name: "a person declines the quote's send: nothing is told, the step returns `declined` (their decision)",
            params: {},
            input: {
                customerCode: "KH-001",
                quotes: { items: [{ key: "0", output: QUOTE }], held: null },
                conversationId: "c1",
                contactId: null,
                locale: "vi",
            },
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { text: TEXT },
                    answer: refused("declined"),
                },
            ],
            agent: [
                {
                    answer: { subject: null, text: TEXT },
                    calls: [{ id: TOOL.brainSearch, args: { query: "thong tin chuyen khoan" }, answer: BANK }],
                },
            ],
            output: {
                declined: true,
                renewalIds: [RENEWAL_ID],
                serviceCodes: ["EXAMPLE-TM"],
                channel: null,
                messageRef: null,
            },
        },
        {
            name: "a person declined every request the customer agreed to: nothing to tell, the step returns `declined`",
            params: {},
            input: {
                customerCode: "KH-001",
                quotes: {
                    items: [
                        {
                            key: "0",
                            output: {
                                declined: true,
                                renewalId: null,
                                serviceCode: "EXAMPLE-TM",
                                termMonths: 12,
                                totalVnd: null,
                                paymentCode: null,
                            },
                        },
                    ],
                    held: null,
                },
                conversationId: "c1",
                contactId: null,
                locale: "vi",
            },
            output: { declined: true, renewalIds: [], serviceCodes: [], channel: null, messageRef: null },
        },
    ],
})
