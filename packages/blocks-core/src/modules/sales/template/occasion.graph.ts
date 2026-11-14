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
import { salesCareOccasionRearmNode } from "../../../nodes/sales/care-occasion-rearm.node"
import { salesCareOccasionWaitNode } from "../../../nodes/sales/care-occasion-wait.node"
import { salesCareOccasionNode } from "../../../nodes/sales/care-occasion.node"
import { careTimerInput, careTimerWhereOf } from "./care.timer"

/** How many days before a date the shop writes (the owner's param, the same on the wait and the re-arm). */
const OCCASION_LEAD_DAYS = 7

/** What the template catalogue shows of `sales.occasion`: its name, summary, the one current version and what it changed. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Nh\u1eafc d\u1ecbp \u0111\u1eb7c bi\u1ec7t", en: "Occasion reminder" },
    summary: { vi: "Nh\u1eafc kh\u00e1ch tr\u01b0\u1edbc d\u1ecbp h\u1ecd \u0111\u00e3 k\u1ec3", en: "Reminds the customer before an occasion they mentioned" },
    version: 11,
    publishedAt: "2026-11-14T03:00:00.000Z",
    notes: {
        vi: "Đọc sự kiện theo một đường chung: route, liên hệ, tài khoản và dữ liệu của sự kiện (trigger.data)",
        en: "Reads its event on the one pipeline: the route, the contact, the account and the event's data (trigger.data)",
    },
    // Seeded ACTIVE (TOOLS-LEAD item 6): a seed or re-seed adds it to the agent active, so its trigger reaches it.
    seedActive: true,
}

/**
 * `sales.occasion` version 9 (Nhac dip dac biet): the occasion timer (`data.kind` occasion; record the customer, item the occasion) wakes `wait` (exact timing, no
 * AI), which routes `due` to the suggestion (`suggest`: the agent writes, the node sends) and then next year's timer (`rearm`); `later`
 * (re-armed once) and `closed` end at their outcomes. `suggest` keeps its key.
 * Change from version 8: `wait` route `declined` and `rearm` declined -> outcome `declined` (a person declined a timer on its card; no notice: a timer).
 */
export const salesOccasionGraph: TemplateGraph = defineTemplateGraph({
    key: "sales.occasion",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: careTimerInput,
    triggers: [trigger(TRIGGER.timerDue, { where: careTimerWhereOf("occasion") })],
    openTo: "agent",
    start: "wait",
    nodes: {
        wait: node(salesCareOccasionWaitNode, {
            input: {
                leadId: ref("trigger.data.data.record"),
                occasionId: ref("trigger.data.data.item", { default: null }),
                dueAt: ref("trigger.data.dueAt", { default: null }),
            },
            params: { occasionLeadDays: OCCASION_LEAD_DAYS },
            routes: { due: "suggest", later: "waiting", closed: "closed", declined: "declined" },
        }),
        suggest: node(salesCareOccasionNode, {
            input: {
                leadId: ref("steps.wait.output.leadId"),
                due: ref("steps.wait.output.due", { default: null }),
                locale: "vi",
            },
            next: "rearm",
        }),
        rearm: node(salesCareOccasionRearmNode, {
            input: { leadId: ref("steps.wait.output.leadId"), due: ref("steps.wait.output.due", { default: null }) },
            params: { occasionLeadDays: OCCASION_LEAD_DAYS },
            next: "rearm-declined",
        }),
        "rearm-declined": ifNode({
            when: equals(ref("steps.rearm.output.declined"), true),
            yes: "declined",
            no: "greeted",
        }),
        greeted: outcome({ name: "greeted", output: { leadId: ref("steps.wait.output.leadId") } }),
        waiting: outcome({ name: "waiting", output: { leadId: ref("steps.wait.output.leadId") } }),
        closed: outcome({ name: "closed", output: { leadId: ref("steps.wait.output.leadId") } }),
        declined: outcome({ name: "declined", output: { leadId: ref("steps.wait.output.leadId") } }),
    },
})
