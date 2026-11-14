import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    and,
    equals,
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    ifNode,
    node,
    notEquals,
    outcome,
    present,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { salesAfterSaleNode } from "../../../nodes/sales/care-after-sale.node"
import { salesCarePlanDeliveryNode } from "../../../nodes/sales/care-plan-delivery.node"
import { salesCarePlanOccasionsNode } from "../../../nodes/sales/care-plan-occasions.node"
import { salesConsultStageNode } from "../../../nodes/sales/consult-stage.node"
import { teamUnsentNoticeNode } from "../../../nodes/team/unsent-notice.node"
import { messageOf } from "../../../messages/catalog"

/** What the template catalogue shows of `sales.after-sale`: its name, summary, the one current version and what it changed. */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "C\u1ea3m \u01a1n sau mua", en: "Thank after sale" },
    summary: {
        vi: "C\u1ea3m \u01a1n kh\u00e1ch khi kho\u1ea3n ti\u1ec1n v\u1ec1 kh\u1edbp \u0111\u01a1n",
        en: "Thanks the customer once the bank's money pays the order",
    },
    version: 16,
    publishedAt: "2026-11-14T14:00:00.000Z",
    notes: {
        vi: "Lời cảm ơn không tới được khách (bị chặn hoặc bị từ chối duyệt) thì báo đội; không đọc được dặn dò chăm sóc thì dừng để hệ thống báo; khách chưa có hồ sơ bán hàng thì bỏ qua bước chuyển giai đoạn, chăm sóc vẫn tiếp tục",
        en: "A thank-you that did not reach the customer (refused or declined) tells the team; care facts that cannot be read stop the step for the engine's report; a customer the sale keeps no record of yet skips the stage move and the care goes on",
    },
    // Seeded ACTIVE (TOOLS-LEAD item 6): a seed or re-seed adds it to the agent active, so its trigger reaches it.
    seedActive: true,
}

/**
 * `sales.after-sale` (Cam on sau mua; the version is the catalogue's): called by the sale (`sales.consult`) or `sales.payment` once a bank
 * credit paid an order exactly, with the order's contact. The thank-you to that person (`thank`, which also finds the sale's record of the
 * person); only when it reached the customer (`sent`, an exact boolean: `ifNode`) and the sale keeps a record of the person (`has-record`; a new
 * customer has none yet: no move, the care goes on) the consult stage moves to `after_sale` (`stage`); a
 * thank-you the send did not deliver (refused or declined, not `route_held`) tells the team (`thank-unsent-notice`, ruling R45). Then the
 * check-in after delivery (`plan-delivery`) and the occasion reminders (`plan-occasions`) are armed, each of them silent for a customer who
 * opted out. `plan-delivery` and `plan-occasions` declined -> outcome `declined` (a person declining a timer on its card is a business
 * outcome; no team notice: it is a timer).
 */
export const salesAfterSaleGraph: TemplateGraph = defineTemplateGraph({
    key: "sales.after-sale",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: z.object({ orderId: z.string().min(1).max(MAX_ID), contactId: z.string().min(1).max(MAX_ID).nullish() }) }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "thank",
    nodes: {
        // No payment reminder to cancel: the sale's payment wait was the reminder (its timeout), and it ended with the payment.
        thank: node(salesAfterSaleNode, {
            input: { orderId: ref("trigger.data.orderId"), contactId: ref("trigger.data.contactId", { default: null }), locale: "vi" },
            next: "thanked-them",
        }),
        "thanked-them": ifNode({
            when: equals(ref("steps.thank.output.sent"), true),
            yes: "has-record",
            no: "thank-unsent",
        }),
        // A NEW customer's order is recorded under the contact alone: the sale keeps no record of the person yet (`leadId` null). The stage
        // is a move on that record, so with none there is nothing to move: the step is skipped, the care goes on (v16; `plan-occasions`
        // already reads a null `leadId` as nothing to arm). The record is made where the person is first kept, not here.
        "has-record": ifNode({
            when: present(ref("steps.thank.output.leadId", { default: null })),
            yes: "stage",
            no: "plan-delivery",
        }),
        // A thank-you the send did not deliver (refused, or declined on its card) is never silent (R45): the team is told, the care goes
        // on. Nothing sent with no refusal is the customer's opt-out (or no person); under a staff hold (`route_held`) a person holds it.
        "thank-unsent": ifNode({
            when: and(present(ref("steps.thank.output.refusal", { default: null })), notEquals(ref("steps.thank.output.refusal", { default: null }), "route_held")),
            yes: "thank-unsent-notice",
            no: "plan-delivery",
        }),
        "thank-unsent-notice": node(teamUnsentNoticeNode, {
            input: {
                step: messageOf("vi", "nodeSalesAfterSaleTitle"),
                ref: ref("steps.thank.output.orderNo"),
                refusal: ref("steps.thank.output.refusal"),
                locale: "vi",
            },
            next: "plan-delivery",
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
            when: equals(ref("steps.plan-occasions.output.declined"), true),
            yes: "declined",
            no: "thanked",
        }),
        thanked: outcome({ name: "thanked", output: { orderId: ref("trigger.data.orderId") } }),
        declined: outcome({ name: "declined", output: { orderId: ref("trigger.data.orderId") } }),
    },
})
