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
import { teamDeclinedNoticeNode } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { webbooksDueNode } from "../../../nodes/webbooks/due.node"
import { webbooksNoticeDraftNode } from "../../../nodes/webbooks/notice-draft.node"
import { webbooksNoticeRecordNode } from "../../../nodes/webbooks/notice-record.node"
import { webbooksNoticeTeamNode } from "../../../nodes/webbooks/notice-team.node"
import { webbooksRoundReportNode } from "../../../nodes/webbooks/round-report.node"
import { webbooksText } from "../copy"

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
 * `webbooks.debt-round` version 4 (Receivable reminders), the agent's one clock (09:00 on weekdays). `due` lists what is due and
 * held; when both lists are empty (`work`, an exact emptiness check) the round ends `nothing-due`. Each due receivable runs a
 * body of its own: the team is told (`team`), the customer notice is written and mailed (`draft`, a
 * side step: the mail tool raises the draft a person sends), then `drafted` (an exact presence check on the mail's reference): a mail that went is recorded in the CRM
 * (`record`), an item with no mail (the truths said not now, no e-mail, no sending mailbox, a declined send, a shop's own `ask`) ends there. A
 * record a person declined (`record-declined`, an exact boolean) is told to the team (`record-notice`, `team.declined-notice`) and
 * its item ends; the round goes on. The loop collects `record`: the report reads the full `due` list for every receivable and each
 * item's record (an item with output null had no customer mail; `declined` names a declined record), so a skipped or declined mail
 * or record is never read as a failure.
 * Change from version 6: `report` declined (`report-declined`) -> outcome `declined` (the declined write is itself a team post, so no
 * notice); `team` answers `declined: true` when its line was declined, a side step (`blocking: false`, a failure of its was always passed
 * over), so the item's customer notice goes on as before.
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
        version: 7,
        publishedAt: "2026-11-14T01:00:00.000Z",
        notes: {
            vi: "T\u1eeb ch\u1ed1i b\u00e1o c\u00e1o v\u00f2ng th\u00ec k\u1ebft th\u00fac declined (kh\u00f4ng c\u00f3 th\u00f4ng b\u00e1o ri\u00eang, v\u00ec ch\u00ednh b\u00e0i \u0111\u0103ng l\u00e0 b\u00e0i c\u1ee7a \u0111\u1ed9i); t\u1eeb ch\u1ed1i d\u00f2ng b\u00e1o \u0111\u1ed9i c\u1ee7a m\u1ed9t kho\u1ea3n ch\u1ec9 b\u1ecf d\u00f2ng \u0111\u00f3, th\u00f4ng b\u00e1o cho kh\u00e1ch v\u1eabn ch\u1ea1y",
            en: "Declining the round report ends the run `declined` (no extra notice: the declined write is itself a team post); declining one receivable's team line skips that line only, the customer notice still runs",
        },
    },
    nodes: {
        due: node(webbooksDueNode, { input: { locale: LOCALE }, next: "work" }),
        work: ifNode({
            when: or(present(ref("steps.due.output.due")), present(ref("steps.due.output.held"))),
            yes: "each",
            no: "nothing-due",
        }),
        each: loop({
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
                    drafted: ifNode({ when: present(ref("steps.draft.output.messageRef")), yes: "record" }),
                    record: node(webbooksNoticeRecordNode, {
                        input: {
                            projectCode: item("projectCode"),
                            messageRef: ref("steps.draft.output.messageRef", { default: null }),
                            why: ref("steps.draft.output.why", { default: null }),
                        },
                        next: "record-declined",
                    }),
                    // A person declined the record: the team is told, then the item ends (`no` absent; `next` absent).
                    "record-declined": ifNode({
                        when: equals(ref("steps.record.output.declined"), true),
                        yes: "record-notice",
                    }),
                    "record-notice": node(teamDeclinedNoticeNode, {
                        input: {
                            step: webbooksText("node.notice-record.title").vi,
                            ref: item("projectCode"),
                            locale: LOCALE,
                            // Inside the loop: only this item is skipped, the round goes on.
                            scope: "item",
                        },
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
            when: equals(ref("steps.report.output.declined"), true),
            yes: "declined",
            no: "reminded",
        }),
        reminded: outcome({ name: "reminded" }),
        "nothing-due": outcome({ name: "nothing-due" }),
        declined: outcome({ name: "declined" }),
    },
})
