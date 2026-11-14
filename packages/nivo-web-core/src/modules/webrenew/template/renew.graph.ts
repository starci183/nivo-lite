import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateGraph,
    callWorkflow,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { teamDeclinedNoticeNode } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { webrenewRenewNode } from "../../../nodes/webrenew/renew.node"
import { webrenewRenewedTeamNode } from "../../../nodes/webrenew/renewed-team.node"
import { webrenewRenewedTellNode } from "../../../nodes/webrenew/renewed-tell.node"
import { webrenewText } from "../copy"
import { TARGETS } from "../ids"

/** The language the team reads (today's constant param). */
const LOCALE = "vi"

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
 * `webrenew.renew` version 6 (Renew at the provider): Accounting calls it for a request it recorded as paid. `renew` checks the request
 * exactly and renews through the CRM (by itself: the customer's money is already recorded); `renewed-team` tells the team where it stands (blocking: a renewal never
 * ends unseen); `renewed-tell` tells the customer (a side step; reached by the lead, else the CRM contact, mail as a draft); then
 * Accounting is called to invoice and the outcome carries the renewal. A person who declines the renewal (a shop's own `ask`) made a decision:
 * `renew-declined` (an exact boolean) tells the team (`renew-notice`, `team.declined-notice`) and the run ends `declined`; nothing
 * is renewed, the customer is told nothing and Accounting is not called. Change from version 4: `notify-lead` is split into the team line
 * and the customer's; `renew` makes its checks in code and calls no AI; the hand-off now runs before the outcome (an outcome ends a
 * branch), with the same inputs. Change from version 5: the declined renewal ends at the outcome `declined` (was `approval_declined`, a
 * name the stored outcome-key grammar refuses). Change from version 8: `renewed-team` declined (`renewed-team-declined`, an exact boolean) ->
 * outcome `declined` (the declined write is itself a team post, so no notice); the renewal was made, but the customer is not told and
 * Accounting is not called.
 */
export const renewGraph: TemplateGraph = defineTemplateGraph({
    key: "webrenew.renew",
    title: { vi: "Gia h\u1ea1n t\u1ea1i nh\u00e0 cung c\u1ea5p", en: "Renew at the provider" },
    input: z.object({ data: renewInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "renew",
    catalogue: {
        name: { vi: "Gia h\u1ea1n t\u1ea1i nh\u00e0 cung c\u1ea5p", en: "Renew at the provider" },
        summary: {
            vi: "K\u1ebf to\u00e1n b\u00e1o kh\u00e1ch \u0111\u00e3 tr\u1ea3 ti\u1ec1n: gia h\u1ea1n t\u1ea1i nh\u00e0 cung c\u1ea5p (t\u1ef1 ch\u1ea1y khi ti\u1ec1n \u0111\u00e3 ghi nh\u1eadn), b\u00e1o kh\u00e1ch v\u00e0 \u0111\u1ed9i, r\u1ed3i g\u1ecdi K\u1ebf to\u00e1n xu\u1ea5t ho\u00e1 \u0111\u01a1n",
            en: "Accounting says the customer paid: renews at the provider (runs by itself once the payment is recorded), tells the customer and the team, then calls Accounting to invoice",
        },
        version: 12,
        // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
        seedActive: true,
        publishedAt: "2026-11-14T04:50:00.000Z",
        notes: {
            vi: "Thời gian gom tin nhắn do khai báo của trigger quyết định, đồ thị không còn tự khai báo",
            en: "How long a burst of messages settles is the trigger declaration's, no longer the graph's",
        },
    },
    nodes: {
        renew: node(webrenewRenewNode, {
            input: {
                renewalId: ref("trigger.data.renewalId"),
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("trigger.data.serviceCode"),
                termMonths: ref("trigger.data.termMonths"),
                transactionRef: ref("trigger.data.transactionRef"),
            },
            next: "renew-declined",
        }),
        "renew-declined": ifNode({
            when: equals(ref("steps.renew.output.declined"), true),
            yes: "renew-notice",
            no: "renewed-team",
        }),
        "renew-notice": node(teamDeclinedNoticeNode, {
            input: { step: webrenewText("node.renew.title").vi, ref: ref("trigger.data.serviceCode"), locale: LOCALE },
            next: "declined",
        }),
        // A person declined the renewal: the team was told; nothing else runs.
        declined: outcome({ name: "declined" }),
        "renewed-team": node(webrenewRenewedTeamNode, {
            input: { customerCode: ref("trigger.data.customerCode"), renewal: ref("steps.renew.output"), locale: LOCALE },
            next: "renewed-team-declined",
        }),
        "renewed-team-declined": ifNode({
            when: equals(ref("steps.renewed-team.output.declined"), true),
            yes: "declined",
            no: "renewed-tell",
        }),
        "renewed-tell": node(webrenewRenewedTellNode, {
            input: {
                customerCode: ref("trigger.data.customerCode"),
                contactId: ref("trigger.data.contactId", { default: null }),
                renewal: ref("steps.renew.output"),
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
            output: {
                customerCode: ref("trigger.data.customerCode"),
                serviceCode: ref("steps.renew.output.serviceCode"),
                renewalId: ref("steps.renew.output.renewalId"),
                termMonths: ref("steps.renew.output.termMonths"),
            },
        }),
    },
})
