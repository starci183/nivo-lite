import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { refused, ZALO, crmAnswered, reminderOf } from "./webrenew.examples"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { ID_MAX, type SentReminder, channelSchema, sentReminderSchema } from "./renew-shapes"
import { isDeclined, recordReminder, textOf } from "./webrenew.calls"
import { webrenewText } from "../../modules/webrenew/copy"

/** The service quoted, the channel the quote went through, and the message it named. */
type QuoteRecordInput = {
    readonly serviceCode: string
    readonly channel: string | null
    readonly messageRef: string | null
}

const ID = "webrenew.quote-record"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<QuoteRecordInput> = z.object({
    serviceCode: z.string().min(1).max(120),
    channel: channelSchema,
    messageRef: z.string().min(1).max(ID_MAX).nullable(),
})
const output: z.ZodType<SentReminder> = sentReminderSchema

const REMINDER_ID = "9a1b2c3d-0000-4000-8000-000000000003"

/**
 * `webrenew.quote-record` (Record the quote): ONE reminder record per quoted service in the CRM (`outcome` "quoted", the channel
 * the quote went through, the message it named), so the round stops reminding a service that waits for its payment. Run once per
 * service by the answer graph's second loop. No AI call. A refused record stops the run (the engine reports it). A person who
 * declines the record made a decision: the step RETURNS `declined` true; the loop's body tells the team and ends that item.
 */
export const webrenewQuoteRecordNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.quoteRecord.title"),
    description: { vi: "Ghi r\u1eb1ng d\u1ecbch v\u1ee5 \u0111\u00e3 \u0111\u01b0\u1ee3c b\u00e1o gi\u00e1 gia h\u1ea1n, \u0111\u1ec3 c\u00e1c \u0111\u1ee3t sau kh\u00f4ng nh\u1eafc l\u1ea1i khi \u0111ang ch\u1edd kh\u00e1ch thanh to\u00e1n.", en: "Records that a service has been quoted for renewal, so later rounds do not remind it while it waits for payment." },
    tools: [CRM_NIVOWEB.post_services_code_reminders],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    run: async (given, context) => {
        const recorded = await recordReminder(context, { ...given, outcome: "quoted" })
        if (isDeclined(recorded))
            return { serviceCode: given.serviceCode, channel: given.channel, declined: true, reminderId: null }
        if (!recorded.ok)
            return context.fail({ kind: "cannot", why: `reminder_record_refused:${recorded.refusal}` }, recorded.facts)
        const reminderId = textOf(recorded.value, "id")
        if (reminderId === null) return context.fail({ kind: "cannot", why: "reminder_record_answered_no_id" })
        return { serviceCode: given.serviceCode, channel: given.channel, declined: false, reminderId }
    },
    examples: [
        {
            name: "records the quote on the service, through the channel the quote went",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", channel: ZALO, messageRef: "msg-2" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "EXAMPLE-TM", channel: ZALO, outcome: "quoted", messageRef: "msg-2" },
                    answer: crmAnswered(reminderOf(REMINDER_ID, "EXAMPLE-TM", ZALO, "quoted", "msg-2")),
                },
            ],
            output: { serviceCode: "EXAMPLE-TM", channel: ZALO, declined: false, reminderId: REMINDER_ID },
        },
        {
            name: "a refused record stops the run",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", channel: ZALO, messageRef: "msg-2" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "EXAMPLE-TM", channel: ZALO, outcome: "quoted", messageRef: "msg-2" },
                    answer: refused("service_not_found"),
                },
            ],
            failure: { kind: "cannot", why: "reminder_record_refused:service_not_found" },
        },
        {
            name: "a person declines the record: nothing is recorded, the step returns `declined`",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", channel: ZALO, messageRef: "msg-2" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "EXAMPLE-TM", channel: ZALO, outcome: "quoted", messageRef: "msg-2" },
                    answer: refused("declined"),
                },
            ],
            output: { serviceCode: "EXAMPLE-TM", channel: ZALO, declined: true, reminderId: null },
        },
    ],
})
