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
import { teamDeclinedNoticeNode } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { webrenewDueNode } from "../../../nodes/webrenew/due.node"
import { webrenewRemindRecordNode } from "../../../nodes/webrenew/remind-record.node"
import { webrenewRemindSendNode } from "../../../nodes/webrenew/remind-send.node"
import { webrenewRoundReportNode } from "../../../nodes/webrenew/round-report.node"
import { webrenewText } from "../copy"

/** The language the round writes in (today's constant param). */
const LOCALE = "vi"

/**
 * `webrenew.round` version 4 (Morning renewal round, the agent's primary): the clock wakes it at 08:00. `due` finds the services
 * to remind today and the ones held; the loop `each` runs, per due service (item key: the service code), the reminder's send
 * (BLOCKING: the round exists to remind), then `sent` (an exact boolean): a reminder that went out is recorded in the CRM by
 * `record`, which the loop collects; one that did not go out ends its item there (its loop output is null) and the round goes on.
 * A person who declines a step a shop set to `ask` made a decision: the send (`send-declined`) or the record (`record-declined`, exact
 * booleans) goes to the team's notice (`send-notice` / `record-notice`, `team.declined-notice`) and that item ends; the round goes
 * on. `report` tells the team (a side step), naming every item with no record as not reminded and every declined record as not
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
        version: 7,
        publishedAt: "2026-11-14T03:00:00.000Z",
        notes: { vi: "L\u1eddi g\u1eedi kh\u00e1ch \u0111i qua b\u01b0\u1edbc d\u00f9ng chung v\u00e0 g\u1eedi t\u1edbi ng\u01b0\u1eddi (li\u00ean h\u1ec7); \u0111\u1ea7u v\u00e0o mang contactId, kh\u00f4ng c\u00f2n leadId", en: "The customer send goes through the shared helper and addresses the person (the contact); inputs carry contactId, never leadId" },
    },
    nodes: {
        due: node(webrenewDueNode, { input: { locale: LOCALE }, next: "each" }),
        each: loop({
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
                        next: "send-declined",
                    }),
                    // A person declined the send: the team is told, the item ends (its output null), the round goes on.
                    "send-declined": ifNode({
                        when: equals(ref("steps.send.output.declined"), true),
                        yes: "send-notice",
                        no: "sent",
                    }),
                    "send-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webrenewText("node.remindSend.title").vi,
                            ref: item("serviceCode"),
                            locale: LOCALE,
                            scope: "item",
                        },
                    }),
                    // A reminder that did not go out has nothing to record: the item ends here (`no` absent), its output null.
                    sent: ifNode({ when: equals(ref("steps.send.output.sent"), true), yes: "record" }),
                    record: node(webrenewRemindRecordNode, {
                        input: {
                            serviceCode: ref("steps.send.output.serviceCode"),
                            channel: ref("steps.send.output.channel", { default: null }),
                            messageRef: ref("steps.send.output.messageRef", { default: null }),
                        },
                        next: "record-declined",
                    }),
                    // A person declined the record: the team is told, the item ends (its output says `declined`).
                    "record-declined": ifNode({
                        when: equals(ref("steps.record.output.declined"), true),
                        yes: "record-notice",
                    }),
                    "record-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webrenewText("node.remindRecord.title").vi,
                            ref: item("serviceCode"),
                            locale: LOCALE,
                            scope: "item",
                        },
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
            output: { reminded: ref("steps.each.output.items"), held: ref("steps.due.output.held") },
        }),
    },
})
