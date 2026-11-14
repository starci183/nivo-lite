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
import { salesCareDeliveryCheckNode } from "../nodes/care-delivery-check.node"
import { salesCareDeliveryWaitNode } from "../nodes/care-delivery-wait.node"
import { careTimerInput, careTimerWhereOf } from "./care.timer"

/** What the template catalogue shows of `sales.delivery-check`: its name, summary, the one current version and what it changed. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "H\u1ecfi th\u0103m sau giao", en: "After-delivery check" },
    summary: { vi: "H\u1ecfi th\u0103m kh\u00e1ch sau khi giao hoa", en: "Checks in with the customer after delivery" },
    version: 10,
    publishedAt: "2026-11-14T03:00:00.000Z",
    notes: {
        vi: "Đọc sự kiện theo một đường chung: route, liên hệ, tài khoản và dữ liệu của sự kiện (trigger.data)",
        en: "Reads its event on the one pipeline: the route, the contact, the account and the event's data (trigger.data)",
    },
    // Seeded ACTIVE (TOOLS-LEAD item 6): a seed or re-seed adds it to the agent active, so its trigger reaches it.
    seedActive: true,
}

/**
 * `sales.delivery-check` version 8 (Hoi tham sau giao): the delivery-check timer (`nivo.tool.timer.arm`, `data.kind` delivery-check) wakes `wait` (exact timing, no AI), which routes `due` to
 * the check-in (`check`: the agent writes, the node sends), `later` (it re-armed ONCE; the count of shipment looks rides on the timer's
 * data) and `closed` to their outcomes. `check` keeps its key.
 * Change from version 7: `wait` route `declined` -> outcome `declined` (a person declined moving the timer on its card; no notice: a timer).
 */
export const salesDeliveryCheckGraph: TemplateGraph = defineTemplateGraph({
    key: "sales.delivery-check",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: careTimerInput,
    triggers: [trigger(TRIGGER.timerDue, { where: careTimerWhereOf("delivery-check") })],
    openTo: "agent",
    start: "wait",
    nodes: {
        wait: node(salesCareDeliveryWaitNode, {
            input: {
                orderId: ref("trigger.data.data.record"),
                dueAt: ref("trigger.data.dueAt", { default: null }),
                shipWaits: ref("trigger.data.data.shipWaits", { default: null }),
            },
            routes: { due: "check", later: "waiting", closed: "closed", declined: "declined" },
        }),
        check: node(salesCareDeliveryCheckNode, {
            input: {
                orderId: ref("steps.wait.output.orderId"),
                due: ref("steps.wait.output.due", { default: null }),
                locale: "vi",
            },
            next: "checked",
        }),
        checked: outcome({ name: "checked", output: { orderId: ref("steps.wait.output.orderId") } }),
        waiting: outcome({ name: "waiting", output: { orderId: ref("steps.wait.output.orderId") } }),
        closed: outcome({ name: "closed", output: { orderId: ref("steps.wait.output.orderId") } }),
        declined: outcome({ name: "declined", output: { orderId: ref("steps.wait.output.orderId") } }),
    },
})
