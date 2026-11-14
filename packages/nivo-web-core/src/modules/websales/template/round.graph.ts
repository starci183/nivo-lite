import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
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
import { websalesDueNode } from "../../../nodes/websales/due.node"
import { websalesFollowRecordNode } from "../../../nodes/websales/follow-record.node"
import { websalesFollowSendMailNode, websalesFollowSendNode } from "../../../nodes/websales/follow-send.node"
import { websalesFollowSendToldNode } from "../../../nodes/websales/follow-send-told.node"
import { websalesRoundReportNode } from "../../../nodes/websales/round-report.node"
import { goesOn, purchaseFact } from "./declined"

/** The language the team reads (version 1's constant param). */
const LOCALE = "vi"

/** What the template catalogue shows of `websales.round` version 7: the texts of version 2, the change note of 7. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Nh\u1eafc b\u00e1o gi\u00e1 ch\u01b0a tr\u1ea3 l\u1eddi", en: "Follow up unanswered quotes" },
    summary: {
        vi: "08:30 ng\u00e0y l\u00e0m vi\u1ec7c t\u00ecm b\u00e1o gi\u00e1 ch\u01b0a \u0111\u01b0\u1ee3c tr\u1ea3 l\u1eddi, nh\u1eafc kh\u00e1ch theo ch\u00ednh s\u00e1ch b\u00e1n h\u00e0ng v\u00e0 b\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3",
        en: "On working days at 08:30 finds the quotes nobody answered, follows up by the sales policy and tells the team the result",
    },
    version: 7,
    publishedAt: "2026-11-14T22:00:00.000Z",
    notes: {
        vi: "R68: lời nhắc hay việc ghi lần nhắc không thành (bị từ chối duyệt, bị chặn) thì hệ thống tự báo đội kèm mã đơn mua, vòng nhắc vẫn tiếp tục; việc gửi được tách theo kênh (cuộc trò chuyện hoặc thư), mỗi bước chỉ một lần ghi",
        en: "R68: a reminder or its record that did not go through (declined, refused) is told to the team by the engine with the purchase code; the round goes on; the send is split by channel (conversation or mail), each step makes one write",
    },
}

/**
 * `websales.round` version 2 (Nhac bao gia chua tra loi, the agent's primary): the clock wakes it on working days at 08:30 (version
 * 1's `SALES_ROUND_TRIGGER`). `due` finds the quotes to follow up today and the ones held; the loop `each` runs, per due purchase (item
 * key: the purchase id), the reminder's send (BLOCKING: the round exists to follow up; the loop COLLECTS it, `SentFollowUp`), the
 * exact check `sent`, and only then its CRM record (an item not sent ends at the check, its why in the collected send); `report` tells the team (a side step); the outcome carries the loop's items and the held purchases.
 * Unsuccessful (a person declined the reminder or its record, a chat send refused, a step's `cannot`): `follow` and `record` declare
 * their `unsuccessful` ending (R68): the ENGINE tells the team (the step, the reason, the purchase code) and the step takes its own exit:
 * a reminder not sent ends the ITEM at `sent`, a record ends it; the round goes on, and the collected `follow-told` output (`declined: true`)
 * lets the report name it. Change from version 5: the `<step>-declined` checks and their notices are gone (the engine reports). Change from
 * version 1: `websales.follow` is split into `follow-send` and `follow-record`; the reach (the conversation, or a mail draft through
 * `nivo.tool.mail.message.send`) is the CRM purchase's data, not the model's choice. Change from version 6 (ask ONE write): the send is
 * split by channel: `follow` (the conversation) then `follow-mail` (the mail), one of them skipped, merged by `follow-told`, which the
 * later steps and the collect read. Hidden without the CRM, or without both every
 * messaging account and the sending mailbox (its send step lists both as alternatives).
 */
export const roundGraph: TemplateGraph = defineTemplateGraph({
    key: "websales.round",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({}),
    triggers: [trigger(TRIGGER.clockTick, { args: { preset: "weekdays_at", at: "08:30" } })],
    openTo: "agent",
    start: "due",
    nodes: {
        due: node(websalesDueNode, { input: { locale: LOCALE }, next: "each" }),
        each: loop({
            label: { vi: "Nhắc từng báo giá", en: "Each quote to follow up" },
            over: ref("steps.due.output.due"),
            key: "purchaseId",
            concurrency: 1,
            body: {
                start: "follow",
                nodes: {
                    follow: node(websalesFollowSendNode, {
                        input: {
                            purchaseId: item("purchaseId"),
                            purchaseCode: item("purchaseCode"),
                            channel: item("channel"),
                            sourceRef: item("sourceRef"),
                            quotedOn: item("quotedOn", { default: null }),
                            validUntil: item("validUntil", { default: null }),
                            lastFollowUpOn: item("lastFollowUpOn", { default: null }),
                            followUpCount: item("followUpCount"),
                            locale: LOCALE,
                        },
                        next: "follow-mail",
                        unsuccessful: goesOn([purchaseFact(item("purchaseCode"))]),
                    }),
                    // The same input: the mail variant recomputes the reach, exactly one of the two sends.
                    "follow-mail": node(websalesFollowSendMailNode, {
                        input: {
                            purchaseId: item("purchaseId"),
                            purchaseCode: item("purchaseCode"),
                            channel: item("channel"),
                            sourceRef: item("sourceRef"),
                            quotedOn: item("quotedOn", { default: null }),
                            validUntil: item("validUntil", { default: null }),
                            lastFollowUpOn: item("lastFollowUpOn", { default: null }),
                            followUpCount: item("followUpCount"),
                            locale: LOCALE,
                        },
                        next: "follow-told",
                        unsuccessful: goesOn([purchaseFact(item("purchaseCode"))]),
                    }),
                    "follow-told": node(websalesFollowSendToldNode, {
                        input: { chat: ref("steps.follow.output"), mail: ref("steps.follow-mail.output") },
                        next: "sent",
                    }),
                    // Not sent (no contact, a refusal, a person declined): no `no`, so the ITEM ends here; its why stays in the
                    // collected `follow-told` output, which the report reads.
                    sent: ifNode({
                        label: { vi: "Đã nhắc được khách?", en: "Reminder sent?" },
                        when: equals(ref("steps.follow-told.output.sent"), true),
                        yes: "record",
                    }),
                    record: node(websalesFollowRecordNode, {
                        input: {
                            purchaseId: ref("steps.follow-told.output.purchaseId"),
                            purchaseCode: ref("steps.follow-told.output.purchaseCode"),
                            recordChannel: ref("steps.follow-told.output.recordChannel", { default: null }),
                            messageRef: ref("steps.follow-told.output.messageRef", { default: null }),
                        },
                        // Recorded or not, the item ends here (no `next`).
                        unsuccessful: goesOn([purchaseFact(ref("steps.follow-told.output.purchaseCode"))]),
                    }),
                },
                // `follow` is the step EVERY item reaches, so each item's output says sent or not, and why (`refusal`); `record` is
                // blocking, so a run that reaches the report recorded every item sent (a record a person declined is named in that
                // item's `record` output, not in the report). A null member (a day the list holds none of, a send not made, a loop
                // under its cap) reads as null, which each receiving input accepts.
                collect: "follow-told",
            },
            next: "report",
        }),
        report: node(websalesRoundReportNode, {
            input: {
                items: ref("steps.each.output.items"),
                capped: ref("steps.each.output.held", { default: null }),
                held: ref("steps.due.output.held"),
                more: ref("steps.due.output.more"),
                locale: LOCALE,
            },
            next: "followed",
        }),
        followed: outcome({
            name: "followed",
            label: { vi: "Đã nhắc xong", en: "Followed up" },
            output: { followed: ref("steps.each.output.items"), held: ref("steps.due.output.held") },
        }),
    },
})
