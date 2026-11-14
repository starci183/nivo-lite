import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    callWorkflow,
    defineTemplateGraph,
    equals,
    ifNode,
    loop,
    node,
    notEquals,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewRenewCheckNode } from "../../../nodes/webrenew/renew-check.node"
import { webrenewRenewNode } from "../../../nodes/webrenew/renew.node"
import { webrenewRenewRecheckNode } from "../../../nodes/webrenew/renew-recheck.node"
import { webrenewRenewRecordNode } from "../../../nodes/webrenew/renew-record.node"
import { webrenewRenewedTeamNode } from "../../../nodes/webrenew/renewed-team.node"
import { webrenewRenewedTellNode } from "../../../nodes/webrenew/renewed-tell.node"
import { TARGETS } from "../ids"

/** The language the team reads (today's constant param). */
const LOCALE = "vi"

/** How often a pending order is read again, and the most rounds (the first reads at once): 8 rounds, 30 minutes apart, 3.5 hours at most. */
const RECHECK_EVERY_MINUTES = 30
const RECHECK_ROUNDS = 8

/** The graph's contract: what Accounting hands on for a paid renewal request; as version 4 (no conversation, no channel). */
const renewInput = z.object({
    renewalId: z.uuid(),
    customerCode: z.string().min(1).max(80),
    serviceCode: z.string().min(1).max(120),
    termMonths: z.number().int().min(1).max(120),
    transactionRef: z.string().min(1).max(200),
    contactId: z.string().min(1).max(100).nullish(),
})

/**
 * `webrenew.renew` version 14 (Renew at the provider, R57): Accounting calls it for a request it recorded as paid. `check` checks the
 * request exactly and reads whether a registrar's tool renews the service; `renew` renews the domain at the registrar (iNET / Tino,
 * mode `ask`: NIVO Web's money) or, when no tool renews it, makes no call (`not_renewable`); `record` writes the registrar's answer on
 * the request in the CRM; `renewed-team` tells the team where it stands on EVERY path (blocking: a renewal never ends unseen). Only a
 * `renewed` outcome (`renewed-check`, exact) tells the customer (`renewed-tell`, a side step) and calls Accounting to invoice; pending,
 * refused and not renewable end `not-renewed` after the team line (a person acts). A person who declines the registrar call made a
 * decision: it is the step's unsuccessful ending (R68), the ENGINE tells the team with the service's code and the run ends `declined`;
 * a declined team post (`renewed-team-declined`) ends `declined` too (the declined write is itself a team post, no notice).
 * Change from version 13 (E-R57): a `pending` order (the registrar took it, its end date did not move yet) is read again by `settle`, a
 * loop of at most 8 rounds with a 30-minute wait between two (`nivo.tool.domain.renewal.get`, the registrar's own end date is the proof):
 * `renewed` goes on the normal road (record in the CRM, tell the team and the customer, call Accounting); still `pending` after the
 * bound goes on the same road and ends `not-renewed` with the team told. Any other answer ends `settle` in its first round, no read.
 * R83: hosting / SSL (no registrar tool) is recorded in the CRM as pending with the note `awaiting_manual_renewal`, the team is told with the
 * service's facts, and the run ends `not-renewed`.
 * Change from version 12: the CRM no longer renews (its `post services/{code}/renewals` and its dry run are gone); the registrar does,
 * the CRM records the answer.
 */
export const renewGraph: TemplateGraph = defineTemplateGraph({
    key: "webrenew.renew",
    title: { vi: "Gia hạn tại nhà cung cấp", en: "Renew at the provider" },
    input: z.object({ data: renewInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "check",
    catalogue: {
        name: { vi: "Gia hạn tại nhà cung cấp", en: "Renew at the provider" },
        summary: {
            vi: "Kế toán báo khách đã trả tiền: gia hạn tên miền tại nhà đăng ký khi người duyệt, ghi kết quả vào CRM, báo đội; chỉ khi đã gia hạn mới báo khách và gọi Kế toán xuất hoá đơn",
            en: "Accounting says the customer paid: renews the domain at the registrar once a person approves, records the answer in the CRM and tells the team; only a renewed service tells the customer and calls Accounting to invoice",
        },
        version: 14,
        // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
        seedActive: true,
        publishedAt: "2026-11-14T22:00:00.000Z",
        notes: {
            vi: "R57: gia hạn tại nhà đăng ký tên miền (iNET, Tino) có người duyệt, CRM chỉ ghi kết quả; chỉ báo khách và xuất hoá đơn khi đã gia hạn. R68: người duyệt từ chối thì hệ thống tự báo đội kèm mã dịch vụ. Đơn nhà đăng ký đã nhận nhưng chưa đổi ngày hết hạn được đọc lại 30 phút một lần, tối đa 8 vòng",
            en: "R57: renews at the domain registrar (iNET, Tino) on a person's approval, the CRM only records the answer; tells the customer and invoices only once renewed. R68: a declined renewal is told to the team by the engine with the service's code. An order the registrar took whose end date did not move is read again every 30 minutes, 8 rounds at most",
        },
    },
    nodes: {
        check: node(webrenewRenewCheckNode, {
            input: {
                renewalId: ref("trigger.data.renewalId"),
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("trigger.data.serviceCode"),
                termMonths: ref("trigger.data.termMonths"),
                transactionRef: ref("trigger.data.transactionRef"),
            },
            next: "renew",
        }),
        renew: node(webrenewRenewNode, {
            input: {
                renewalId: ref("steps.check.output.renewalId"),
                serviceCode: ref("steps.check.output.serviceCode"),
                termMonths: ref("steps.check.output.termMonths"),
                domain: ref("steps.check.output.domain", { default: null }),
                years: ref("steps.check.output.years", { default: null }),
                provider: ref("steps.check.output.provider", { default: null }),
                reason: ref("steps.check.output.reason", { default: null }),
            },
            next: "settle",
            // R68: a person declining the registrar call (or the step's `cannot`) is told to the team by the ENGINE, with the service's
            // code, and the run ends `declined` (was `renew-declined` + `renew-notice`).
            unsuccessful: {
                then: "end",
                outcome: "declined",
                facts: [{ label: { vi: "Mã dịch vụ", en: "Service" }, value: ref("trigger.data.serviceCode") }],
            },
        }),
        // A person declined the renewal (the engine told the team) or a team post: nothing else runs.
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" } }),
        // A pending order is read again until the registrar's end date moves (round 1 reads at once, the rounds after wait 30 minutes);
        // any other answer passes through round 1 with no read. Out of rounds the order is still pending and goes on the same road.
        settle: loop({
            label: { vi: "Đọc lại đơn đang chờ", en: "Re-read the pending order" },
            exits: {
                until: { vi: "Thoát khi không còn chờ", en: "Ends when no longer pending" },
                exhausted: { vi: "Hết 8 vòng mà vẫn chờ", en: "8 rounds used, still pending" },
            },
            until: notEquals(ref("steps.recheck.output.outcome"), "pending"),
            max: RECHECK_ROUNDS,
            every: { minutes: RECHECK_EVERY_MINUTES },
            body: {
                start: "recheck",
                nodes: {
                    recheck: node(webrenewRenewRecheckNode, {
                        input: { renewal: ref("steps.renew.output"), domain: ref("steps.check.output.domain", { default: null }) },
                    }),
                },
            },
            next: "settled",
            exhausted: "settled",
        }),
        // A loop's last output is nullable (a loop that ran no round); this one runs at least one, so `no` is never taken. It proves the
        // answer present for the steps after it (the save check's narrowing).
        settled: ifNode({
            label: { vi: "Có kết quả đơn gia hạn?", en: "Renewal answer in hand?" },
            when: present(ref("steps.settle.output.last")),
            yes: "record",
            no: "not-renewed",
        }),
        record: node(webrenewRenewRecordNode, {
            input: { renewal: ref("steps.settle.output.last") },
            next: "renewed-team",
        }),
        "renewed-team": node(webrenewRenewedTeamNode, {
            input: { customerCode: ref("trigger.data.customerCode"), renewal: ref("steps.settle.output.last"), locale: LOCALE },
            next: "renewed-team-declined",
        }),
        "renewed-team-declined": ifNode({
            label: { vi: "Bị từ chối báo đội?", en: "Team post declined?" },
            when: equals(ref("steps.renewed-team.output.declined"), true),
            yes: "declined",
            no: "renewed-check",
        }),
        // Only a renewal the registrar made tells the customer and calls Accounting; the team line said what a person must do otherwise.
        "renewed-check": ifNode({
            label: { vi: "Đã gia hạn tại nhà đăng ký?", en: "Renewed at the registrar?" },
            when: equals(ref("steps.settle.output.last.outcome"), "renewed"),
            yes: "renewed-tell",
            no: "not-renewed",
        }),
        "renewed-tell": node(webrenewRenewedTellNode, {
            input: {
                customerCode: ref("trigger.data.customerCode"),
                contactId: ref("trigger.data.contactId", { default: null }),
                renewal: ref("steps.settle.output.last"),
                locale: LOCALE,
            },
            next: "to-invoice",
        }),
        "to-invoice": callWorkflow({
            agent: TARGETS.books,
            workflow: TARGETS.invoice,
            version: "latest",
            input: {
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("steps.renew.output.serviceCode"),
                renewalId: ref("steps.renew.output.renewalId"),
                termMonths: ref("steps.renew.output.termMonths"),
            },
            next: "renewed",
        }),
        renewed: outcome({
            name: "renewed",
            label: { vi: "Đã gia hạn", en: "Renewed" },
            output: {
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("steps.renew.output.serviceCode"),
                renewalId: ref("steps.renew.output.renewalId"),
                termMonths: ref("steps.renew.output.termMonths"),
            },
        }),
        "not-renewed": outcome({
            name: "not-renewed",
            label: { vi: "Chưa gia hạn", en: "Not renewed" },
            output: {
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("steps.renew.output.serviceCode"),
                renewalId: ref("steps.renew.output.renewalId"),
                outcome: ref("steps.settle.output.last.outcome"),
                reason: ref("steps.settle.output.last.reason"),
            },
        }),
    },
})
