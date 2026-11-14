import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { type DueServiceInput, ID_MAX, channelSchema, dueServiceInputSchema } from "./renew-shapes"
import {
    DECLINED,
    MAIL_CHANNEL,
    formOf,
    quotablePricesOf,
    reachOfCustomer,
    tellCustomer,
    textOf,
    toldOf,
    wordsSchemaOf,
} from "./webrenew.calls"
import {
    refused,
    DUE_TM,
    LEAD_CONTACT,
    ZALO,
    crmAnswered,
    customerOf,
    draftedVia,
    pricesOf,
    sentOn,
} from "./webrenew.examples"
import { webrenewText } from "../../modules/webrenew/copy"

/** Whether the reminder went out, through which provider and with which message; or why not. */
type RemindSendOutput = {
    /** The service reminded, as given. */
    readonly serviceCode: string
    /** True when the send went through. */
    readonly sent: boolean
    /** True when a person declined the send (a shop's own `ask`): their decision, the graph's `declined` branch (the team is told). */
    readonly declined: boolean
    /** The channel the send went through (the lead send's `channel` fact, `email` for a mail); null when not sent. */
    readonly channel: string | null
    /** The message (or mail draft) id the send answered; null when not sent. */
    readonly messageRef: string | null
    /**
     * Why it was not sent: the send's refusal, or `no_contact` when the CRM knows no way to reach the customer; null when sent.
     */
    readonly refusal: string | null
}

const ID = "webrenew.remind-send"

/** The refusal the step names itself when the CRM customer has neither a lead contact nor a mail address. */
const NO_CONTACT = "no_contact"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<DueServiceInput> = dueServiceInputSchema
const output: z.ZodType<RemindSendOutput> = z.object({
    serviceCode: z.string().min(1).max(120),
    sent: z.boolean(),
    declined: z.boolean(),
    channel: channelSchema,
    messageRef: z.string().min(1).max(ID_MAX).nullable(),
    refusal: z.string().min(1).max(ID_MAX).nullable(),
})

const GOAL =
    "Remind this one customer that this service ends soon and ask whether they renew, in the shop's voice from the truths, in ONE " +
    "message of the given `form` (a chat line, or a mail with a subject). You may quote a price only from `prices` in the input; when " +
    "it is empty, say the price follows. Never write a date, price or total the input does not give. Write the words only: the step " +
    "sends them."

const ZALO_TEXT =
    "Chao anh, ten mien example.vn cua cong ty se het han ngay 12/12/2026. Anh co muon gia han khong a? Gia gia han em gui sau."
const MAIL_SUBJECT = "Gia han ten mien example.vn"
const MAIL_TEXT =
    "Kinh gui Cong ty Mau, ten mien example.vn se het han ngay 12/12/2026. Quy khach vui long tra loi neu muon gia han; gia gia han chung toi gui sau."

/**
 * `webrenew.remind-send` (Write and send the reminder): the round's purpose, run once per due service inside the round's loop
 * (BLOCKING: the round exists to remind). The step reads the CRM customer and the price list; an exact check on the customer it
 * read decides the reach: a contact that carries a NIVO customer id is told with the lead send, a customer known only by a mail
 * address with the mail send (the mail tool raises a draft a person sends); with neither, nothing is sent and the output says `no_contact`.
 * Only price-sheet rows are quotable (an exact filter in code). The agent writes the words; the step sends them, both sends
 * go by themselves (mode `auto`, R83: a reminder built from the CRM's data). A refused send is said in the output: the graph records nothing for it, the round goes on and its report names the
 * service; never retried another way. A person who declines the send made a decision: the step RETURNS `declined` true, the
 * round's body tells the team (`team.declined-notice`) and ends that item; the round goes on. The record is the next step, only
 * for a reminder sent.
 */
export const webrenewRemindSendNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.remindSend.title"),
    description: { vi: "So\u1ea1n v\u00e0 g\u1eedi kh\u00e1ch l\u1eddi nh\u1eafc gia h\u1ea1n d\u1ecbch v\u1ee5 s\u1eafp h\u1ebft h\u1ea1n, qua k\u00eanh kh\u00e1ch \u0111ang d\u00f9ng ho\u1eb7c qua th\u01b0.", en: "Writes and sends the customer a reminder to renew a service that is ending, through their chat channel or by email." },
    tools: [CRM_NIVOWEB.get_customers_code, CRM_NIVOWEB.get_prices, TOOL.customerMessageSend, TOOL.mailMessageSend],
    // R83 (owner, interim, the CEO reviews later): a first reminder is built from the CRM's own data (service, end date, price sheet), so it goes by itself.
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta, PROVIDER.smtp, CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    sensitive: { messageRef: "pii" },
    run: async (given, context) => {
        const notSent = (refusal: string): RemindSendOutput => ({
            serviceCode: given.serviceCode,
            sent: false,
            declined: refusal === DECLINED,
            channel: null,
            messageRef: null,
            refusal,
        })
        const customer = await context.tools.call(CRM_NIVOWEB.get_customers_code, { code: given.customerCode })
        if (!customer.ok)
            return context.fail({ kind: "cannot", why: `customer_read_refused:${customer.refusal}` }, customer.facts)
        const reach = reachOfCustomer(customer.value)
        if (reach === null) return notSent(NO_CONTACT)
        const prices = await context.tools.call(CRM_NIVOWEB.get_prices, {})
        if (!prices.ok)
            return context.fail({ kind: "cannot", why: `price_read_refused:${prices.refusal}` }, prices.facts)
        const { locale, ...service } = given
        const form = formOf(reach)
        const words = await context.agent.run({
            goal: GOAL,
            input: {
                service,
                customer: { name: textOf(customer.value, "name") },
                form,
                prices: [...quotablePricesOf(prices.value, given.serviceClass)],
                locale,
            },
            output: wordsSchemaOf(form),
            tools: [],
            maxTurns: 4,
        })
        const sent = await tellCustomer(context, reach, words, { kind: "service", code: given.serviceCode })
        if (!sent.ok) return notSent(sent.declined === true ? DECLINED : sent.refusal)
        const told = toldOf(reach, sent)
        return {
            serviceCode: given.serviceCode,
            sent: true,
            declined: false,
            channel: told.channel,
            messageRef: told.messageRef,
            refusal: null,
        }
    },
    examples: [
        {
            name: "a customer with a lead contact gets one chat message through the conversation's provider",
            params: {},
            input: { ...DUE_TM, locale: "vi" },
            tools: [
                { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-001" }, answer: crmAnswered(customerOf([LEAD_CONTACT])) },
                { id: CRM_NIVOWEB.get_prices, args: {}, answer: crmAnswered(pricesOf("placeholder")) },
                {
                    id: TOOL.customerMessageSend,
                    args: { contactId: "lead-001", text: ZALO_TEXT },
                    answer: sentOn(ZALO, "msg-1"),
                },
            ],
            agent: [{ answer: { subject: null, text: ZALO_TEXT } }],
            output: {
                serviceCode: "EXAMPLE-TM",
                sent: true,
                declined: false,
                channel: ZALO,
                messageRef: "msg-1",
                refusal: null,
            },
        },
        {
            name: "a first contact with only an e-mail gets a mail draft a person sends",
            params: {},
            input: { ...DUE_TM, locale: "vi" },
            tools: [
                { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-001" }, answer: crmAnswered(customerOf([])) },
                { id: CRM_NIVOWEB.get_prices, args: {}, answer: crmAnswered(pricesOf("placeholder")) },
                {
                    id: TOOL.mailMessageSend,
                    args: {
                        to: "lienhe@example.vn",
                        subject: MAIL_SUBJECT,
                        body: MAIL_TEXT,
                        ref: { kind: "service", code: "EXAMPLE-TM" },
                    },
                    answer: draftedVia(PROVIDER.smtp, "draft-1"),
                },
            ],
            agent: [{ answer: { subject: MAIL_SUBJECT, text: MAIL_TEXT } }],
            output: {
                serviceCode: "EXAMPLE-TM",
                sent: true,
                declined: false,
                channel: MAIL_CHANNEL,
                messageRef: "draft-1",
                refusal: null,
            },
        },
        {
            name: "a customer with neither a lead contact nor a mail address is not sent anything",
            params: {},
            input: { ...DUE_TM, locale: "vi" },
            tools: [{ id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-001" }, answer: crmAnswered(customerOf([], null)) }],
            output: {
                serviceCode: "EXAMPLE-TM",
                sent: false,
                declined: false,
                channel: null,
                messageRef: null,
                refusal: NO_CONTACT,
            },
        },
        {
            name: "a refused send is said in the output and never tried another way",
            params: {},
            input: { ...DUE_TM, locale: "vi" },
            tools: [
                { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-001" }, answer: crmAnswered(customerOf([LEAD_CONTACT])) },
                { id: CRM_NIVOWEB.get_prices, args: {}, answer: crmAnswered(pricesOf("placeholder")) },
                {
                    id: TOOL.customerMessageSend,
                    args: { contactId: "lead-001", text: ZALO_TEXT },
                    answer: refused("no_channel_identity"),
                },
            ],
            agent: [{ answer: { subject: null, text: ZALO_TEXT } }],
            output: {
                serviceCode: "EXAMPLE-TM",
                sent: false,
                declined: false,
                channel: null,
                messageRef: null,
                refusal: "no_channel_identity",
            },
        },
        {
            name: "a person declines the mail draft: not sent, the step returns `declined` (their decision, never a failure)",
            params: {},
            input: { ...DUE_TM, locale: "vi" },
            tools: [
                { id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-001" }, answer: crmAnswered(customerOf([])) },
                { id: CRM_NIVOWEB.get_prices, args: {}, answer: crmAnswered(pricesOf("placeholder")) },
                {
                    id: TOOL.mailMessageSend,
                    args: {
                        to: "lienhe@example.vn",
                        subject: MAIL_SUBJECT,
                        body: MAIL_TEXT,
                        ref: { kind: "service", code: "EXAMPLE-TM" },
                    },
                    answer: refused("declined"),
                },
            ],
            agent: [{ answer: { subject: MAIL_SUBJECT, text: MAIL_TEXT } }],
            output: {
                serviceCode: "EXAMPLE-TM",
                sent: false,
                declined: true,
                channel: null,
                messageRef: null,
                refusal: "declined",
            },
        },
    ],
})
