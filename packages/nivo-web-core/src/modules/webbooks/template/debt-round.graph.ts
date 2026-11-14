import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    item,
    loop,
    node,
    or,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webbooksDueNode } from "../../../nodes/webbooks/due.node"
import { webbooksNoticeDraftNode } from "../../../nodes/webbooks/notice-draft.node"
import { webbooksNoticeRecordNode } from "../../../nodes/webbooks/notice-record.node"
import { webbooksNoticeTeamNode } from "../../../nodes/webbooks/notice-team.node"
import { webbooksRoundReportNode } from "../../../nodes/webbooks/round-report.node"

/** The language the team reads (today's templates fix it). */
const LOCALE = "vi"

/** The item of the loop, bound one to one into each body step that takes the whole receivable (a member the CRM left null stays null). */
const ITEM = {
    projectCode: item("projectCode"),
    customerCode: item("customerCode", { default: null }),
    dueOn: item("dueOn", { default: null }),
    lastNoticeOn: item("lastNoticeOn", { default: null }),
    why: item("why"),
    locale: LOCALE,
}

/**
 * `webbooks.debt-round` version 8 (Receivable reminders), the agent's one clock (09:00 on weekdays). `due` lists what is due and
 * held; when both lists are empty (`work`, an exact emptiness check) the round ends `nothing-due`. Each due receivable runs a
 * body of its own: the team is told (`team`), the customer notice is written and mailed (`draft`, a
 * side step: the mail tool raises the draft a person sends), then `drafted` (an exact presence check on the mail's reference): a mail that went is recorded in the CRM
 * (`record`), an item with no mail (the truths said not now, no e-mail, no sending mailbox, a declined send, a shop's own `ask`) ends there. A
 * record a person declined is the record step's unsuccessful ending (R68): the ENGINE tells the team (the step, `declined`, the
 * project's code) and its item ends; the round goes on. The loop collects `record`: the report reads the full `due` list for every receivable and each
 * item's record (an item with output null had no customer mail; `declined` names a declined record), so a skipped or declined mail
 * or record is never read as a failure.
 * Change from version 6: `report` declined (`report-declined`) -> outcome `declined` (the declined write is itself a team post, so no
 * notice); `team` answers `declined: true` when its line was declined, a side step (`blocking: false`, a failure of its was always passed
 * over), so the item's customer notice goes on as before. Change from version 7 (R68): the hand-drawn `record-declined`/`record-notice`
 * pair is the record step's `unsuccessful` option (same item end, same team notice facts).
 */
export const debtRoundGraph: TemplateGraph = defineTemplateGraph({
    key: "webbooks.debt-round",
    title: { vi: "Nh\u1eafc c\u00f4ng n\u1ee3", en: "Receivable reminders" },
    input: z.object({}),
    triggers: [trigger(TRIGGER.clockTick, { args: { preset: "weekdays_at", at: "09:00" } })],
    openTo: "agent",
    start: "due",
    catalogue: {
        name: { vi: "Nh\u1eafc c\u00f4ng n\u1ee3", en: "Receivable reminders" },
        summary: {
            vi: "9:00 m\u1ed7i ng\u00e0y l\u00e0m vi\u1ec7c: t\u00ecm c\u00e1c kho\u1ea3n ph\u1ea3i thu \u0111\u1ebfn h\u1ea1n theo \u0111i\u1ec1u kho\u1ea3n c\u1ee7a c\u00f4ng ty, b\u00e1o ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch, so\u1ea1n th\u00f4ng b\u00e1o g\u1eedi kh\u00e1ch, ghi nh\u1eadn l\u1ea7n nh\u1eafc v\u00e0 b\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3",
            en: "09:00 every weekday: finds the project receivables due by the company's terms, tells the person in charge, writes the customer notice mail, records the notice and reports the round to the team",
        },
        version: 8,
        publishedAt: "2026-11-14T22:00:00.000Z",
        notes: {
            vi: "R68: ghi nhận lần nhắc bị từ chối duyệt thì hệ thống tự báo đội kèm mã dự án, vòng nhắc vẫn tiếp tục; quy trình chỉ còn các bước nghiệp vụ",
            en: "R68: a notice record a person declined is told to the team by the engine with the project code and the round goes on; the workflow keeps only its business steps",
        },
    },
    nodes: {
        due: node(webbooksDueNode, { input: { locale: LOCALE }, next: "work" }),
        work: ifNode({
            label: { vi: "Có khoản đến hạn hoặc đang giữ?", en: "Anything due or held?" },
            when: or(present(ref("steps.due.output.due")), present(ref("steps.due.output.held"))),
            yes: "each",
            no: "nothing-due",
        }),
        each: loop({
            label: { vi: "Từng khoản phải thu đến hạn", en: "Each receivable due" },
            over: ref("steps.due.output.due"),
            key: "projectCode",
            concurrency: 1,
            body: {
                start: "team",
                collect: "record",
                nodes: {
                    // A side line (`blocking: false`): declined or not, the item's notice goes on as before.
                    team: node(webbooksNoticeTeamNode, { input: ITEM, next: "draft" }),
                    draft: node(webbooksNoticeDraftNode, { input: ITEM, next: "drafted" }),
                    // `draft` is a side step (skipped without a sending mailbox): no reference, no mail, the item ends here.
                    drafted: ifNode({
                        label: { vi: "Đã gửi thư báo khách?", en: "Customer notice mailed?" },
                        when: present(ref("steps.draft.output.messageRef")),
                        yes: "record",
                    }),
                    record: node(webbooksNoticeRecordNode, {
                        input: {
                            projectCode: item("projectCode"),
                            messageRef: ref("steps.draft.output.messageRef", { default: null }),
                            why: ref("steps.draft.output.why", { default: null }),
                        },
                        // The item ends here either way (`next` absent). A person declined the record: the engine tells the team
                        // (R68, the project's code) and the round goes on (`continue`, a loop body's default).
                        unsuccessful: { then: "continue", facts: [{ label: { vi: "Mã dự án", en: "Project" }, value: item("projectCode") }] },
                    }),
                },
            },
            next: "report",
        }),
        report: node(webbooksRoundReportNode, {
            input: {
                due: ref("steps.due.output.due"),
                items: ref("steps.each.output.items"),
                held: ref("steps.due.output.held"),
                locale: LOCALE,
            },
            next: "report-declined",
        }),
        // A person declined the round report: the report was the team's own post, so no notice; the run ends `declined`.
        "report-declined": ifNode({
            label: { vi: "Bị từ chối báo cáo vòng?", en: "Round report declined?" },
            when: equals(ref("steps.report.output.declined"), true),
            yes: "declined",
            no: "reminded",
        }),
        reminded: outcome({ name: "reminded", label: { vi: "Đã nhắc công nợ", en: "Reminded" } }),
        "nothing-due": outcome({ name: "nothing-due", label: { vi: "Không có khoản đến hạn", en: "Nothing due" } }),
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" } }),
    },
})
