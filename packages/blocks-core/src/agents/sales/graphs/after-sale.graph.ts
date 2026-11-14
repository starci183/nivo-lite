import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    and,
    equals,
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    ifNode,
    node,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { salesAfterSaleNode } from "../nodes/care-after-sale.node"
import { salesCarePlanDeliveryNode } from "../nodes/care-plan-delivery.node"
import { salesCarePlanOccasionsNode } from "../nodes/care-plan-occasions.node"
import { salesConsultStageNode } from "../nodes/consult-stage.node"

/** What the template catalogue shows of `sales.after-sale`: its name, summary, the one current version and what it changed. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "C\u1ea3m \u01a1n sau mua", en: "Thank after sale" },
    summary: {
        vi: "C\u1ea3m \u01a1n kh\u00e1ch khi kho\u1ea3n ti\u1ec1n v\u1ec1 kh\u1edbp \u0111\u01a1n",
        en: "Thanks the customer once the bank's money pays the order",
    },
    version: 17,
    publishedAt: "2026-11-14T18:00:00.000Z",
    notes: {
        vi: "Lời cảm ơn không tới được khách (bị chặn hoặc bị từ chối duyệt) thì hệ thống tự báo đội kèm mã đơn, chăm sóc vẫn tiếp tục; quy trình chỉ còn các bước chăm sóc",
        en: "A thank-you that did not reach the customer (refused or declined) is told to the team by the engine with the order's code and the care goes on; the workflow keeps only the care's steps",
    },
    // Seeded ACTIVE (TOOLS-LEAD item 6): a seed or re-seed adds it to the agent active, so its trigger reaches it.
    seedActive: true,
}

/**
 * `sales.after-sale` (Cam on sau mua; the version is the catalogue's): called by the sale (`sales.consult`) or `sales.payment` once a bank
 * credit paid an order exactly, with the order (its id and code) and its contact. The thank-you to that person (`thank`, which also finds
 * the sale's record of the person); only when it reached the customer (`sent`) and the sale keeps a record of the person (`has-record`; a
 * new customer has none yet: no move, the care goes on) the consult stage moves to `after_sale` (`stage`); a thank-you the send did not
 * deliver (refused or declined, not `route_held`) is the step's unsuccessful ending: the ENGINE tells the team the order's code and the
 * care goes on (R45, R68). Then the check-in after delivery (`plan-delivery`) and the occasion reminders (`plan-occasions`) are armed, each of them silent for a customer who
 * opted out. `plan-delivery` and `plan-occasions` declined -> outcome `declined` (a person declining a timer on its card is a business
 * outcome; no team notice: it is a timer).
 */
export const salesAfterSaleGraph: TemplateGraph = defineTemplateGraph({
    key: "sales.after-sale",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({
        data: z.object({
            orderId: z.string().min(1).max(MAX_ID),
            // The order's code, for the team notice of a thank-you that did not reach the customer; null when the caller has none.
            orderNo: z.string().min(1).max(MAX_ID).nullish(),
            contactId: z.string().min(1).max(MAX_ID).nullish(),
        }),
    }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "thank",
    nodes: {
        // No payment reminder to cancel: the sale's payment wait was the reminder (its timeout), and it ended with the payment.
        thank: node(salesAfterSaleNode, {
            input: { orderId: ref("trigger.data.orderId"), contactId: ref("trigger.data.contactId", { default: null }), locale: "vi" },
            next: "has-record",
            unsuccessful: { then: "continue", facts: [{ label: { vi: "Mã đơn", en: "Order" }, value: ref("trigger.data.orderNo", { default: null }) }] },
        }),
        // The stage moves only for a thank-you that reached the customer and a person the sale keeps a record of. A NEW customer's order is
        // recorded under the contact alone (`leadId` null): with no record there is nothing to move, the care goes on (v16; `plan-occasions`
        // already reads a null `leadId` as nothing to arm). The record is made where the person is first kept, not here.
        "has-record": ifNode({
            label: { vi: "Đã cảm ơn và có hồ sơ khách?", en: "Thanked, with a sale record?" },
            when: and(equals(ref("steps.thank.output.sent"), true), present(ref("steps.thank.output.leadId", { default: null }))),
            yes: "stage",
            no: "plan-delivery",
        }),
        stage: node(salesConsultStageNode, {
            input: { leadId: ref("steps.thank.output.leadId", { default: null }) },
            params: { stage: "after_sale" },
            next: "plan-delivery",
        }),
        "plan-delivery": node(salesCarePlanDeliveryNode, {
            input: { orderId: ref("trigger.data.orderId") },
            next: "plan-delivery-declined",
        }),
        "plan-delivery-declined": ifNode({
            label: { vi: "Bị từ chối hẹn hỏi thăm?", en: "Check-in declined?" },
            when: equals(ref("steps.plan-delivery.output.declined"), true),
            yes: "declined",
            no: "plan-occasions",
        }),
        "plan-occasions": node(salesCarePlanOccasionsNode, {
            input: { leadId: ref("steps.thank.output.leadId", { default: null }) },
            params: { occasionLeadDays: 7 },
            next: "plan-occasions-declined",
        }),
        "plan-occasions-declined": ifNode({
            label: { vi: "Bị từ chối hẹn ngày đặc biệt?", en: "Occasion reminders declined?" },
            when: equals(ref("steps.plan-occasions.output.declined"), true),
            yes: "declined",
            no: "thanked",
        }),
        thanked: outcome({ name: "thanked", label: { vi: "Đã cảm ơn", en: "Thanked" }, output: { orderId: ref("trigger.data.orderId") } }),
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" }, output: { orderId: ref("trigger.data.orderId") } }),
    },
})
