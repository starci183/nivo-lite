import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../../bounds"
import { messageOf } from "../../../messages/catalog"
import { salesWebOrderKeepNode } from "../../../nodes/sales/web-order-keep.node"
import { salesWebOrderLeadNode } from "../../../nodes/sales/web-order-lead.node"
import { salesWebOrderNoticeNode } from "../../../nodes/sales/web-order-notice.node"
import { teamDeclinedNoticeNode } from "../../../nodes/team/declined-notice.node"

/** What the website form supplies: the core contact it met (a generic member), and in the event's data the request and how to reach them. */
const webOrderInput = z.object({
    contactId: z.string().min(1).max(MAX_ID),
    data: z.object({
        request: z.string().min(1).max(MAX_BODY),
        contact: z
            .object({
                name: z.string().max(MAX_LINE).nullish(),
                phone: z.string().max(MAX_LINE).nullish(),
                email: z.string().max(MAX_LINE).nullish(),
            })
            .nullish(),
    }),
})

/** What the template catalogue shows of `sales.web-order`: its name, summary, the one current version and what it changed. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "\u0110\u01a1n t\u1eeb website", en: "Website order" },
    summary: {
        vi: "Nh\u1eadn \u0111\u01a1n t\u1eeb trang web v\u00e0 nh\u1edd ch\u1ee7 g\u1ecdi x\u00e1c nh\u1eadn",
        en: "Takes a website order and asks the owner to call",
    },
    version: 8,
    publishedAt: "2026-11-14T03:00:00.000Z",
    notes: {
        vi: "Đọc sự kiện theo một đường chung: route, liên hệ, tài khoản và dữ liệu của sự kiện (trigger.data)",
        en: "Reads its event on the one pipeline: the route, the contact, the account and the event's data (trigger.data)",
    },
    // Seeded ACTIVE (TOOLS-LEAD item 6): a seed or re-seed adds it to the agent active, so its trigger reaches it.
    seedActive: true,
}

/**
 * `sales.web-order` version 7 (Don tu website): `lead` finds or makes the sale's own record of the contact the website met (`trigger.contactId`; the wake has no record id), `keep` writes what the request tells on the
 * customer, then `notice` asks the team to call them back (the graph's purpose). Woken by the website form's own verb
 * `nivo.trigger.website.message.received` (the engine's road, no provider; ruling R6: one verb per customer channel) with today's
 * `request present`. The contact the form left may be absent: the notice takes null for a phone or an email not given.
 * Change from version 6: `lead` declined -> a team notice (`lead-declined-notice`), then outcome `declined` (the website visitor's request is not
 * kept; a person declining a write on its card is a business outcome).
 */
export const salesWebOrderGraph: TemplateGraph = defineTemplateGraph({
    key: "sales.web-order",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: webOrderInput,
    triggers: [trigger(TRIGGER.websiteMessageReceived, { where: [{ param: "data.request", op: "present" }] })],
    openTo: "agent",
    start: "lead",
    nodes: {
        lead: node(salesWebOrderLeadNode, {
            input: {
                contactId: ref("trigger.contactId"),
                request: ref("trigger.data.request"),
                name: ref("trigger.data.contact.name", { default: null }),
            },
            next: "lead-declined",
        }),
        "lead-declined": ifNode({
            when: equals(ref("steps.lead.output.declined"), true),
            yes: "lead-declined-notice",
            no: "keep",
        }),
        "lead-declined-notice": node(teamDeclinedNoticeNode, {
            input: { step: messageOf("vi", "nodeSalesWebOrderLeadTitle"), ref: null, locale: "vi" },
            next: "declined",
        }),
        keep: node(salesWebOrderKeepNode, {
            input: { leadId: ref("steps.lead.output.leadId"), request: ref("trigger.data.request") },
            next: "notice",
        }),
        notice: node(salesWebOrderNoticeNode, {
            input: {
                leadId: ref("steps.lead.output.leadId"),
                request: ref("trigger.data.request"),
                phone: ref("trigger.data.contact.phone", { default: null }),
                email: ref("trigger.data.contact.email", { default: null }),
                locale: "vi",
            },
            next: "to-owner",
        }),
        "to-owner": outcome({ name: "owner", output: { summary: ref("steps.notice.output.summary") } }),
        declined: outcome({ name: "declined" }),
    },
})
