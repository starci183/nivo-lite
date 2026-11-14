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
import { websalesLinkFindNode } from "../../../nodes/websales/link-find.node"
import { websalesLinkNotifyNode } from "../../../nodes/websales/link-notify.node"
import { websalesLinkWriteNode } from "../../../nodes/websales/link-write.node"
import { DECLINED_END, declinedEnd, declinedNotice } from "./declined"

/** The language the team reads (version 1's constant param). */
const LOCALE = "vi"

/** The graph's contract: the request the Sales chat turn hands on (`websales.team-route`'s `request`), holding the lead id. */
const linkInput = z.object({ text: z.string().min(1).max(8000), actorMemberId: z.string().min(1).max(120).nullish() })

/** What the notice takes, on either route. */
const NOTICE = {
    branch: ref("steps.write.output.branch"),
    leadId: ref("steps.write.output.contactId"),
    customerCode: ref("steps.write.output.customerCode", { default: null }),
    candidates: ref("steps.find.output.candidates"),
    locale: LOCALE,
}

/** What the template catalogue shows of `websales.link` version 4: the texts of version 3, the change note of 4 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Li\u00ean k\u1ebft kh\u00e1ch v\u1edbi CRM", en: "Link a customer to the CRM" },
    summary: {
        vi: "Khi ng\u01b0\u1eddi trong \u0111\u1ed9i nh\u1edd Kinh doanh li\u00ean k\u1ebft m\u1ed9t kh\u00e1ch trong chat \u0111\u1ed9i (l\u01b0\u1ee3t tr\u1ea3 l\u1eddi \u0111\u1ed9i chuy\u1ec3n y\u00eau c\u1ea7u sang): t\u00ecm kh\u00e1ch trong CRM theo nh\u1eefng g\u00ec \u0111\u00e3 bi\u1ebft, li\u00ean k\u1ebft kh\u00e1ch v\u00e0 b\u00e1o \u0111\u1ed9i k\u1ebft qu\u1ea3; kh\u00f4ng t\u1ea1o kh\u00e1ch m\u1edbi",
        en: "When a person of the team asks Sales in the team chat to link a customer (the chat turn hands the request on): finds the customer in the CRM by what is known, links it and tells the team the result; opens no new customer",
    },
    version: 7,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T04:50:00.000Z",
    notes: {
        vi: "Thời gian gom tin nhắn do khai báo của trigger quyết định, đồ thị không còn tự khai báo",
        en: "How long a burst of messages settles is the trigger declaration's, no longer the graph's",
    },
}
/**
 * `websales.link` version 3 (Lien ket khach voi CRM): a person of the team names a lead to link in the team chat, and the chat turn
 * (`websales.team-chat`, its `route` step) hands the request on (a workflow call, the agent's own). `find` searches the CRM's customers,
 * `write` links the ONE clear candidate or none, routing `linked` / `none`; on each route the notice (side) tells the team and
 * the outcome ends it (`linked`, `unknown`). A person who declines the link (a decision) routes `declined`: `write-notice`
 * (`team.declined-notice`, the step's title and the lead), then outcome `declined`. Change from version 1: `link-propose` is split into the write and the notice; the notice
 * is keyed per route so each outcome follows its own. Hidden without the CRM.
 */
export const linkGraph: TemplateGraph = defineTemplateGraph({
    key: "websales.link",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: linkInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "find",
    nodes: {
        find: node(websalesLinkFindNode, { input: { text: ref("trigger.data.text"), locale: LOCALE }, next: "write" }),
        write: node(websalesLinkWriteNode, {
            input: {
                // The id the team named is read as the contact's (the person); the find step still calls it `leadId`.
                contactId: ref("steps.find.output.leadId"),
                candidates: ref("steps.find.output.candidates"),
                text: ref("trigger.data.text"),
            },
            routes: { linked: "tell-linked", none: "tell-none", declined: "write-notice" },
        }),
        "tell-linked": node(websalesLinkNotifyNode, { input: NOTICE, next: "linked" }),
        linked: outcome({
            name: "linked",
            output: { leadId: ref("steps.write.output.contactId"), customerCode: ref("steps.write.output.customerCode") },
        }),
        "tell-none": node(websalesLinkNotifyNode, { input: NOTICE, next: "unknown" }),
        unknown: outcome({ name: "unknown", output: { leadId: ref("steps.write.output.contactId") } }),
        // The link is about the lead, which has no code: the notice names its id.
        "write-notice": declinedNotice("node.link-write.title", ref("steps.write.output.contactId"), DECLINED_END),
        [DECLINED_END]: declinedEnd(),
    },
})
