import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    defineTemplateGraph,
    endItem,
    equals,
    ifNode,
    loop,
    item,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewMailReplyRecordNode } from "../../../nodes/webrenew/mail-reply-record.node"
import { webrenewMailReplyTeamNode } from "../../../nodes/webrenew/mail-reply-team.node"
import { ROUND_SERVICES_MAX } from "../../../nodes/webrenew/renew-shapes"

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
 * `webrenew.mail-replies` (Renewal replies by mail): the Mailbox agent calls it with the customers' mail replies to
 * renewal reminders. The loop `each` runs, per mail (item key: the mail id), the record (the loop collects it) and the team's
 * line (a side step). A person continues: nothing is quoted, renewed or answered. A person who declines the record made a
 * decision: it is the step's unsuccessful ending (R68): the ENGINE tells the team with the service's code, and `record-declined`
 * (an exact boolean) ends that mail's item; the other mails go on. Earlier: `webrenew.mail-reply` was split into the record and the
 * team line.
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
        version: 8,
        // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
        seedActive: true,
        publishedAt: "2026-11-14T22:00:00.000Z",
        notes: {
            vi: "R68: bản ghi bị từ chối duyệt thì hệ thống tự báo đội kèm mã dịch vụ; thư đó dừng, các thư khác vẫn tiếp tục",
            en: "R68: a declined record is told to the team by the engine with the service's code; that mail ends, the others go on",
        },
    },
    nodes: {
        each: loop({
            label: { vi: "Mỗi thư trả lời", en: "Each reply mail" },
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
                        // R68: a person declining the record is told to the team by the ENGINE with the service's code (was the
                        // `record-notice` node).
                        unsuccessful: {
                            then: "continue",
                            facts: [
                                // A step's own output is not upstream of its notice: the fact reads what the mail named.
                                { label: { vi: "Mã dịch vụ", en: "Service" }, value: item("serviceCode", { default: null }) },
                                { label: { vi: "Mã khách hàng", en: "Customer" }, value: item("customerCode", { default: null }) },
                            ],
                        },
                    }),
                    // Business, kept: a declined record ends that mail's item with no team line of its own (the engine's notice
                    // is the one post), the other mails go on.
                    "record-declined": ifNode({
                        label: { vi: "Bị từ chối ghi nhận?", en: "Record declined?" },
                        when: equals(ref("steps.record.output.declined"), true),
                        yes: endItem,
                        no: "team",
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
        recorded: outcome({ name: "recorded", label: { vi: "Đã ghi nhận", en: "Recorded" } }),
    },
})
