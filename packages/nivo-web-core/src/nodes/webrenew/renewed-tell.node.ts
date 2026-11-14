import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { refused, LEAD_ID, RENEWAL_ID, ZALO, crmAnswered, customerOf, draftedVia, sentOn } from "./webrenew.examples"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { optionalId } from "./answer-shapes"
import { type RenewOutput, renewOutputSchema } from "./renew.node"
import { ID_MAX, type TeamLocale, channelSchema, localeSchema } from "./renew-shapes"
import {
    type CustomerReach,
    DECLINED,
    MAIL_CHANNEL,
    formOf,
    reachOfCustomer,
    reachOfIds,
    tellCustomer,
    toldOf,
    wordsSchemaOf,
} from "./webrenew.calls"
import { webrenewText } from "../../modules/webrenew/copy"

/**
 * The renewal as the provider step left it, the customer, the NIVO customer (lead) when Accounting named one, and the language.
 */
type RenewedTellInput = {
    readonly customerCode: string
    readonly contactId: string | null
    readonly renewal: RenewOutput
    readonly locale: TeamLocale
}

/** Whether the customer was told, through which channel and with which message; or why not (a person's `declined` too). */
type RenewedTellOutput = {
    readonly told: boolean
    readonly channel: string | null
    readonly messageRef: string | null
    readonly refusal: string | null
}

const ID = "webrenew.renewed-tell"

/** The refusal the step names itself when the CRM knows no way to reach the customer. */
const NO_CONTACT = "no_contact"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<RenewedTellInput> = z.object({
    customerCode: z.string().min(1).max(80),
    contactId: optionalId,
    renewal: renewOutputSchema,
    locale: localeSchema,
})
const output: z.ZodType<RenewedTellOutput> = z.object({
    told: z.boolean(),
    channel: channelSchema,
    messageRef: z.string().min(1).max(ID_MAX).nullable(),
    refusal: z.string().min(1).max(ID_MAX).nullable(),
})

const GOAL =
    "Tell the customer where their renewal stands, in ONE message of the given `form`. Say the service is renewed only when `state` is " +
    "`renewed`; for `pending_person` say the payment is received and the renewal is being done; never write a date the input does not " +
    "give. Write the words only: the step sends them."

const TEXT = "Da ben em da nhan duoc tien gia han ten mien example.vn va dang gia han, xong em bao anh ngay a."
const SUBJECT = "Gia han ten mien example.vn"

const RENEWAL: RenewOutput = {
    renewalId: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    state: "pending_person",
    dryRun: true,
    newExpiresOn: null,
}

/** The answer of a step that told nobody, with the reason. */
const notTold = (refusal: string): RenewedTellOutput => ({
    told: false,
    channel: null,
    messageRef: null,
    refusal,
})

/**
 * `webrenew.renewed-tell` (Tell the customer where the renewal stands): a side step (`blocking: false`) after the team is told.
 * The run serves no conversation (the money chain starts at the bank), so the reach is the data's: the lead Accounting named,
 * else the CRM customer's contact read here (a lead contact, else a mail address: a draft a person sends). The agent writes the
 * words only as the CRM's state says; the step sends them, by itself, mode `auto` (the mail is a draft a person sends). No way to reach the customer, the CRM's refusal of the
 * customer read, or a refused send, is said in the output.
 */
export const webrenewRenewedTellNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.renewedTell.title"),
    description: { vi: "B\u00e1o kh\u00e1ch t\u00ecnh tr\u1ea1ng gia h\u1ea1n d\u1ecbch v\u1ee5 \u0111\u00fang nh\u01b0 h\u1ec7 th\u1ed1ng kh\u00e1ch h\u00e0ng ghi.", en: "Tells the customer where their service renewal stands, exactly as the customer system records it." },
    tools: [CRM_NIVOWEB.get_customers_code, TOOL.customerMessageSend, TOOL.mailMessageSend],
    mode: "auto",
    accounts: [PROVIDER.zaloOa, PROVIDER.telegram, PROVIDER.meta, PROVIDER.smtp, CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        // The CRM's own refusal of the read (`not_found`, an outside 4xx) is said in the output as it is, never read as "no contact".
        const reachOfCrm = async (): Promise<CustomerReach | { readonly refusal: string } | null> => {
            const customer = await context.tools.call(CRM_NIVOWEB.get_customers_code, { code: given.customerCode })
            return customer.ok ? reachOfCustomer(customer.value) : { refusal: customer.refusal }
        }
        const found = reachOfIds(null, given.contactId) ?? (await reachOfCrm())
        if (found === null) return notTold(NO_CONTACT)
        if ("refusal" in found) return notTold(found.refusal)
        const reach = found
        const form = formOf(reach)
        const words = await context.agent.run({
            goal: GOAL,
            input: { renewal: given.renewal, form, locale: given.locale },
            output: wordsSchemaOf(form),
            maxTurns: 1,
        })
        const sent = await tellCustomer(context, reach, words, { kind: "renewal", code: given.renewal.renewalId })
        if (!sent.ok) return notTold(sent.declined === true ? DECLINED : sent.refusal)
        return { told: true, ...toldOf(reach, sent), refusal: null }
    },
    examples: [
        {
            name: "a dry-run renewal waiting for a person: tells the customer it is being done, by the lead Accounting named",
            params: {},
            input: { customerCode: "KH-001", contactId: LEAD_ID, renewal: RENEWAL, locale: "vi" },
            agent: [{ answer: { subject: null, text: TEXT } }],
            tools: [
                {
                    id: TOOL.customerMessageSend,
                    args: { contactId: LEAD_ID, text: TEXT },
                    answer: sentOn(ZALO, "msg-7"),
                },
            ],
            output: { told: true, channel: ZALO, messageRef: "msg-7", refusal: null },
        },
        {
            name: "with no lead, a customer known only by mail gets a mail draft a person sends",
            params: {},
            input: { customerCode: "KH-001", contactId: null, renewal: RENEWAL, locale: "vi" },
            agent: [{ answer: { subject: SUBJECT, text: TEXT } }],
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
                    answer: draftedVia(PROVIDER.smtp, "draft-3"),
                },
            ],
            output: { told: true, channel: MAIL_CHANNEL, messageRef: "draft-3", refusal: null },
        },
        {
            name: "with no lead, a customer the CRM does not know: not told, the CRM's refusal said in the output",
            params: {},
            input: { customerCode: "KH-001", contactId: null, renewal: RENEWAL, locale: "vi" },
            tools: [{ id: CRM_NIVOWEB.get_customers_code, args: { code: "KH-001" }, answer: refused("not_found") }],
            output: { told: false, channel: null, messageRef: null, refusal: "not_found" },
        },
        {
            name: "a refused send is said in the output",
            params: {},
            input: { customerCode: "KH-001", contactId: LEAD_ID, renewal: RENEWAL, locale: "vi" },
            agent: [{ answer: { subject: null, text: TEXT } }],
            tools: [
                { id: TOOL.customerMessageSend, args: { contactId: LEAD_ID, text: TEXT }, answer: refused("no_channel_identity") },
            ],
            output: { told: false, channel: null, messageRef: null, refusal: "no_channel_identity" },
        },
        {
            name: "a person declines the send: said in the output as their decision",
            params: {},
            input: { customerCode: "KH-001", contactId: LEAD_ID, renewal: RENEWAL, locale: "vi" },
            agent: [{ answer: { subject: null, text: TEXT } }],
            tools: [{ id: TOOL.customerMessageSend, args: { contactId: LEAD_ID, text: TEXT }, answer: refused("declined") }],
            output: { told: false, channel: null, messageRef: null, refusal: "declined" },
        },
    ],
})
