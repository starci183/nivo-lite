import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { refused, ZALO, crmAnswered, reminderOf } from "./webrenew.examples"
import { z } from "zod"
import { webrenewText } from "../../modules/webrenew/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { type SentReminder, channelSchema, sentReminderSchema } from "./renew-shapes"
import { isDeclined, recordReminder, textOf } from "./webrenew.calls"

/** The service the customer declined, and the channel of the conversation they said it in (null when not known). */
type CloseRecordInput = {
    readonly serviceCode: string
    readonly channel: string | null
}

const ID = "webrenew.close-record"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<CloseRecordInput> = z.object({ serviceCode: z.string().min(1).max(120), channel: channelSchema })
const output: z.ZodType<SentReminder> = sentReminderSchema

const REMINDER_ID = "9a1b2c3d-0000-4000-8000-000000000004"

/**
 * `webrenew.close-record` (Record no renewal): ONE reminder record per declined service in the CRM (`outcome` "declined"), so the
 * next rounds stop reminding it. Run once per service by the answer graph's decline loop; the graph's purpose on this route. No
 * AI call. A refused record stops the run (the engine reports it). A person who declines the record made a decision: the step
 * RETURNS `declined` true; the loop's body tells the team and ends that item.
 */
export const webrenewCloseRecordNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.close.title"),
    description: { vi: "Ghi v\u00e0o h\u1ed3 s\u01a1 r\u1eb1ng kh\u00e1ch kh\u00f4ng gia h\u1ea1n d\u1ecbch v\u1ee5 n\u00e0y, \u0111\u1ec3 c\u00e1c \u0111\u1ee3t sau kh\u00f4ng nh\u1eafc l\u1ea1i n\u1eefa.", en: "Records in the customer file that the customer is not renewing this service, so later rounds stop reminding them." },
    tools: [CRM_NIVOWEB.post_services_code_reminders],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    run: async (given, context) => {
        const recorded = await recordReminder(context, { ...given, outcome: "declined", messageRef: null })
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
            name: "records the decline on the service",
            params: {},
            input: { serviceCode: "SAMPLE-HOST", channel: ZALO },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "SAMPLE-HOST", channel: ZALO, outcome: "declined" },
                    answer: crmAnswered(reminderOf(REMINDER_ID, "SAMPLE-HOST", ZALO, "declined", null)),
                },
            ],
            output: { serviceCode: "SAMPLE-HOST", channel: ZALO, declined: false, reminderId: REMINDER_ID },
        },
        {
            name: "a refused record stops the run",
            params: {},
            input: { serviceCode: "SAMPLE-HOST", channel: null },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "SAMPLE-HOST", outcome: "declined" },
                    answer: refused("service_not_found"),
                },
            ],
            failure: { kind: "cannot", why: "reminder_record_refused:service_not_found" },
        },
        {
            name: "a person declines the record: nothing is recorded, the step returns `declined`",
            params: {},
            input: { serviceCode: "SAMPLE-HOST", channel: null },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "SAMPLE-HOST", outcome: "declined" },
                    answer: refused("declined"),
                },
            ],
            output: { serviceCode: "SAMPLE-HOST", channel: null, declined: true, reminderId: null },
        },
    ],
})
