import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    item,
    loop,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewDueNode } from "../../../nodes/webrenew/due.node"
import { webrenewRemindRecordNode } from "../../../nodes/webrenew/remind-record.node"
import { webrenewRemindSendNode } from "../../../nodes/webrenew/remind-send.node"
import { webrenewRoundReportNode } from "../../../nodes/webrenew/round-report.node"

/** The language the round writes in (today's constant param). */
const LOCALE = "vi"

/**
 * `webrenew.round` (Morning renewal round, the agent's primary): the clock wakes it at 08:00. `due` finds the services
 * to remind today and the ones held; the loop `each` runs, per due service (item key: the service code), the reminder's send
 * (BLOCKING: the round exists to remind), then `sent` (an exact boolean): a reminder that went out is recorded in the CRM by
 * `record`, which the loop collects; one that did not go out ends its item there (its loop output is null) and the round goes on.
 * A person who declines the send (mode `ask`, MXW-1) or the record made a decision: it is the step's unsuccessful ending (R68), the
 * ENGINE tells the team with the service's code and that item ends; the round goes on. `report` tells the team (a side step), naming every item with no record as not reminded and every declined record as not
 * recorded; the outcome carries the loop's items and the held services. Change from version 3: `webrenew.ask` is split into `remind-send` and `remind-record`; the reach (lead
 * send or mail send) is decided by the CRM customer's data, not by the model; the mail is `nivo.tool.mail.message.send` instead of a
 * `send_email` work item.
 */
export const roundGraph: TemplateGraph = defineTemplateGraph({
    key: "webrenew.round",
    title: { vi: "Nh\u1eafc gia h\u1ea1n m\u1ed7i s\u00e1ng", en: "Morning renewal round" },
    input: z.object({}),
    triggers: [trigger(TRIGGER.clockTick, { args: { preset: "daily_at", at: "08:00" } })],
    openTo: "agent",
    start: "due",
    catalogue: {
        name: { vi: "Nh\u1eafc gia h\u1ea1n m\u1ed7i s\u00e1ng", en: "Morning renewal round" },
        summary: {
            vi: "08:00 m\u1ed7i ng\u00e0y t\u00ecm d\u1ecbch v\u1ee5 s\u1eafp h\u1ebft h\u1ea1n, nh\u1eafc kh\u00e1ch theo quy \u0111\u1ecbnh gia h\u1ea1n v\u00e0 b\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3",
            en: "Every day at 08:00 finds the services that end soon, reminds the customers by the renewal rules and tells the team the result",
        },
        version: 8,
        publishedAt: "2026-11-14T22:00:00.000Z",
        notes: {
            vi: "R68: lời nhắc hoặc bản ghi bị từ chối duyệt thì hệ thống tự báo đội kèm mã dịch vụ, lượt nhắc vẫn tiếp tục; quy trình chỉ còn các bước nghiệp vụ",
            en: "R68: a declined reminder or record is told to the team by the engine with the service's code and the round goes on; the workflow keeps only its business steps",
        },
    },
    nodes: {
        due: node(webrenewDueNode, { input: { locale: LOCALE }, next: "each" }),
        each: loop({
            label: { vi: "Mỗi dịch vụ sắp hết hạn", en: "Each service due" },
            over: ref("steps.due.output.due"),
            key: "serviceCode",
            concurrency: 1,
            body: {
                start: "send",
                nodes: {
                    send: node(webrenewRemindSendNode, {
                        input: {
                            serviceCode: item("serviceCode"),
                            customerCode: item("customerCode"),
                            serviceClass: item("serviceClass"),
                            domain: item("domain", { default: null }),
                            expiresOn: item("expiresOn", { default: null }),
                            expirySource: item("expirySource"),
                            lastReminderOn: item("lastReminderOn", { default: null }),
                            reminderCount: item("reminderCount"),
                            locale: LOCALE,
                        },
                        next: "sent",
                        // R68: a person declining the send is told to the team by the ENGINE with the service's code; the step's
                        // output says `sent: false`, so `sent` ends the item and the round goes on (was `send-declined` + `send-notice`).
                        unsuccessful: { then: "continue", facts: [{ label: { vi: "Mã dịch vụ", en: "Service" }, value: item("serviceCode") }] },
                    }),
                    // A reminder that did not go out (refused, declined, no way to reach) has nothing to record: the item ends here
                    // (`no` absent), its output null.
                    sent: ifNode({
                        label: { vi: "Đã gửi nhắc?", en: "Reminder sent?" },
                        when: equals(ref("steps.send.output.sent"), true),
                        yes: "record",
                    }),
                    record: node(webrenewRemindRecordNode, {
                        input: {
                            serviceCode: ref("steps.send.output.serviceCode"),
                            channel: ref("steps.send.output.channel", { default: null }),
                            messageRef: ref("steps.send.output.messageRef", { default: null }),
                        },
                        // R68: a person declining the record is told to the team by the ENGINE with the service's code; the item
                        // ends here (its output says `declined`), the round goes on (was `record-declined` + `record-notice`).
                        unsuccessful: { then: "continue", facts: [{ label: { vi: "Mã dịch vụ", en: "Service" }, value: item("serviceCode") }] },
                    }),
                },
                collect: "record",
            },
            next: "report",
        }),
        report: node(webrenewRoundReportNode, {
            input: { reminded: ref("steps.each.output"), held: ref("steps.due.output.held"), locale: LOCALE },
            next: "rounded",
        }),
        rounded: outcome({
            name: "rounded",
            label: { vi: "Đã nhắc xong lượt", en: "Round done" },
            output: { reminded: ref("steps.each.output.items"), held: ref("steps.due.output.held") },
        }),
    },
})
