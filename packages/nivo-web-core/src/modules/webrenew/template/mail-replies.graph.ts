import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    loop,
    item,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { teamDeclinedNoticeNode } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { webrenewMailReplyRecordNode } from "../../../nodes/webrenew/mail-reply-record.node"
import { webrenewMailReplyTeamNode } from "../../../nodes/webrenew/mail-reply-team.node"
import { ROUND_SERVICES_MAX } from "../../../nodes/webrenew/renew-shapes"
import { webrenewText } from "../copy"

/** The language the team reads (today's constant param). */
const LOCALE = "vi"

/** One mail as the Mailbox agent hands it on. */
const mail = z.object({
    mailId: z.string().min(1).max(100),
    from: z.string().max(400),
    subject: z.string().max(400),
    summary: z.string().min(1).max(400),
    customerCode: z.string().min(1).max(80).nullish(),
    serviceCode: z.string().min(1).max(120).nullish(),
})

/**
 * `webrenew.mail-replies` version 4 (Renewal replies by mail): the Mailbox agent calls it with the customers' mail replies to
 * renewal reminders. The loop `each` runs, per mail (item key: the mail id), the record (the loop collects it) and the team's
 * line (a side step). A person continues: nothing is quoted, renewed or answered. A person who declines the record made a
 * decision: `record-declined` (an exact boolean) tells the team (`record-notice`, `team.declined-notice`) and that mail's item
 * ends; the other mails go on. Change from version 3: `webrenew.mail-reply` is
 * split into the record and the team line.
 */
export const mailRepliesGraph: TemplateGraph = defineTemplateGraph({
    key: "webrenew.mail-replies",
    title: { vi: "Tr\u1ea3 l\u1eddi gia h\u1ea1n qua th\u01b0", en: "Renewal replies by mail" },
    input: z.object({ data: z.object({ mails: z.array(mail).min(1).max(ROUND_SERVICES_MAX) }) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "each",
    catalogue: {
        name: { vi: "Tr\u1ea3 l\u1eddi gia h\u1ea1n qua th\u01b0", en: "Renewal replies by mail" },
        summary: {
            vi: "H\u1ed9p th\u01b0 chuy\u1ec3n c\u00e1c th\u01b0 kh\u00e1ch tr\u1ea3 l\u1eddi l\u1eddi nh\u1eafc gia h\u1ea1n: ghi nh\u1eadn c\u00e2u tr\u1ea3 l\u1eddi v\u00e0o CRM v\u00e0 b\u00e1o \u0111\u1ed9i; ng\u01b0\u1eddi l\u00e0m ti\u1ebfp, agent kh\u00f4ng b\u00e1o gi\u00e1 hay gia h\u1ea1n",
            en: "The Mailbox agent passes the customers' mail replies to renewal reminders: records each answer in the CRM and tells the team; a person continues, the agent never quotes or renews",
        },
        version: 7,
        // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
        seedActive: true,
        publishedAt: "2026-11-14T04:50:00.000Z",
        notes: {
            vi: "Thời gian gom tin nhắn do khai báo của trigger quyết định, đồ thị không còn tự khai báo",
            en: "How long a burst of messages settles is the trigger declaration's, no longer the graph's",
        },
    },
    nodes: {
        each: loop({
            over: ref("trigger.data.mails"),
            key: "mailId",
            concurrency: 1,
            body: {
                start: "record",
                nodes: {
                    record: node(webrenewMailReplyRecordNode, {
                        input: {
                            mailId: item("mailId"),
                            from: item("from"),
                            subject: item("subject"),
                            summary: item("summary"),
                            customerCode: item("customerCode", { default: null }),
                            serviceCode: item("serviceCode", { default: null }),
                            locale: LOCALE,
                        },
                        next: "record-declined",
                    }),
                    "record-declined": ifNode({
                        when: equals(ref("steps.record.output.declined"), true),
                        yes: "record-notice",
                        no: "team",
                    }),
                    "record-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webrenewText("node.mailReply.title").vi,
                            ref: ref("steps.record.output.serviceCode", { default: null }),
                            locale: LOCALE,
                            scope: "item",
                        },
                    }),
                    team: node(webrenewMailReplyTeamNode, {
                        input: {
                            from: item("from"),
                            subject: item("subject"),
                            summary: item("summary"),
                            customerCode: ref("steps.record.output.customerCode", { default: null }),
                            serviceCode: ref("steps.record.output.serviceCode", { default: null }),
                            recorded: ref("steps.record.output.recorded", { default: null }),
                            locale: LOCALE,
                        },
                    }),
                },
                collect: "record",
            },
            next: "recorded",
        }),
        recorded: outcome({ name: "recorded" }),
    },
})
