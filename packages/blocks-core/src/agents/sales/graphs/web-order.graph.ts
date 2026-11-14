import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { salesWebOrderKeepNode } from "../nodes/web-order-keep.node"
import { salesWebOrderLeadNode } from "../nodes/web-order-lead.node"
import { salesWebOrderNoticeNode } from "../nodes/web-order-notice.node"

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
    version: 9,
    publishedAt: "2026-11-14T18:00:00.000Z",
    notes: {
        vi: "Bước ghi khách bị từ chối duyệt thì hệ thống tự báo đội rồi kết thúc như trước; quy trình chỉ còn các bước nhận đơn",
        en: "A declined customer record is told to the team by the engine, then the run ends as before; the workflow keeps only the order's steps",
    },
    // Seeded ACTIVE (TOOLS-LEAD item 6): a seed or re-seed adds it to the agent active, so its trigger reaches it.
    seedActive: true,
}

/**
 * `sales.web-order` (Don tu website; the version is the catalogue's): `lead` finds or makes the sale's own record of the contact the website met (`trigger.contactId`; the wake has no record id), `keep` writes what the request tells on the
 * customer, then `notice` asks the team to call them back (the graph's purpose). Woken by the website form's own verb
 * `nivo.trigger.website.message.received` (the engine's road, no provider; ruling R6: one verb per customer channel) with today's
 * `request present`. The contact the form left may be absent: the notice takes null for a phone or an email not given.
 * `lead` declined: the ENGINE tells the team (the step's unsuccessful ending, R68), then outcome `declined` (the website visitor's request
 * is not kept; a person declining a write on its card is a business outcome).
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
            next: "keep",
            unsuccessful: { then: "end", outcome: "declined" },
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
        "to-owner": outcome({ name: "owner", label: { vi: "Chuyển chủ shop", en: "Passed to the owner" }, output: { summary: ref("steps.notice.output.summary") } }),
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" } }),
    },
})
