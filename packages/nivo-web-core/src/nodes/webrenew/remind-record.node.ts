import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { refused, ZALO, crmAnswered, reminderOf } from "./webrenew.examples"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { ID_MAX, type SentReminder, channelSchema, sentReminderSchema } from "./renew-shapes"
import { MAIL_CHANNEL, isDeclined, recordReminder, textOf } from "./webrenew.calls"
import { webrenewText } from "../../modules/webrenew/copy"

/** The reminder just sent: the service, the provider the send answered, the message it named. */
type RemindRecordInput = {
    readonly serviceCode: string
    readonly channel: string | null
    readonly messageRef: string | null
}

const ID = "webrenew.remind-record"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<RemindRecordInput> = z.object({
    serviceCode: z.string().min(1).max(120),
    channel: channelSchema,
    messageRef: z.string().min(1).max(ID_MAX).nullable(),
})
const output: z.ZodType<SentReminder> = sentReminderSchema

const REMINDER_ID = "9a1b2c3d-0000-4000-8000-000000000001"

/**
 * `webrenew.remind-record` (Record the reminder): ONE record of the reminder just sent, in the CRM (`outcome` "sent", the
 * channel the send went through, the message it named), so the next rounds count it. No AI call. It is the node the round's loop
 * collects: its output is the round's `SentReminder`. A refused record stops the run (the engine reports it): a reminder the CRM
 * does not know would be sent again tomorrow. Reached only for a reminder that went out: the round's `sent` check ends any other item
 * before this step, so its report names that service as not reminded. A person who declines the record made a decision: the
 * step RETURNS `declined` true (no reminder id); the round's body tells the team (`team.declined-notice`) and ends that item, and
 * the report names the service as reminded but not recorded.
 */
export const webrenewRemindRecordNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.remindRecord.title"),
    description: { vi: "Ghi l\u1ea1i l\u1eddi nh\u1eafc gia h\u1ea1n v\u1eeba g\u1eedi, \u0111\u1ec3 c\u00e1c \u0111\u1ee3t sau t\u00ednh s\u1ed1 l\u1ea7n \u0111\u00e3 nh\u1eafc.", en: "Records the renewal reminder just sent, so later rounds count how many times the customer was reminded." },
    tools: [CRM_NIVOWEB.post_services_code_reminders],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    sensitive: { reminderId: "pii" },
    run: async (given, context) => {
        const recorded = await recordReminder(context, { ...given, outcome: "sent" })
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
            name: "records the reminder sent through the conversation's channel",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", channel: ZALO, messageRef: "msg-1" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "EXAMPLE-TM", channel: ZALO, outcome: "sent", messageRef: "msg-1" },
                    answer: crmAnswered(reminderOf(REMINDER_ID, "EXAMPLE-TM", ZALO, "sent", "msg-1")),
                },
            ],
            output: { serviceCode: "EXAMPLE-TM", channel: ZALO, declined: false, reminderId: REMINDER_ID },
        },
        {
            name: "records the mail draft as the reminder",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", channel: MAIL_CHANNEL, messageRef: "draft-1" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "EXAMPLE-TM", channel: MAIL_CHANNEL, outcome: "sent", messageRef: "draft-1" },
                    answer: crmAnswered(
                        reminderOf(
                            "9a1b2c3d-0000-4000-8000-000000000002",
                            "EXAMPLE-TM",
                            MAIL_CHANNEL,
                            "sent",
                            "draft-1",
                        ),
                    ),
                },
            ],
            output: {
                serviceCode: "EXAMPLE-TM",
                channel: MAIL_CHANNEL,
                declined: false,
                reminderId: "9a1b2c3d-0000-4000-8000-000000000002",
            },
        },
        {
            name: "a refused record stops the run",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", channel: ZALO, messageRef: "msg-1" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "EXAMPLE-TM", channel: ZALO, outcome: "sent", messageRef: "msg-1" },
                    answer: refused("service_not_found"),
                },
            ],
            failure: { kind: "cannot", why: "reminder_record_refused:service_not_found" },
        },
        {
            name: "a person declines the record: nothing is recorded, the step returns `declined`",
            params: {},
            input: { serviceCode: "EXAMPLE-TM", channel: ZALO, messageRef: "msg-1" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_services_code_reminders,
                    args: { code: "EXAMPLE-TM", channel: ZALO, outcome: "sent", messageRef: "msg-1" },
                    answer: refused("declined"),
                },
            ],
            output: { serviceCode: "EXAMPLE-TM", channel: ZALO, declined: true, reminderId: null },
        },
    ],
})
