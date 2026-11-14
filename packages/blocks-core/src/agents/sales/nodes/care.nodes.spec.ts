import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { ARMED, CARE_OPEN, ORDER_O1, personReadsOf } from "./care.examples"
import { answered } from "../../../shared/nodes/tool-answers"
import { salesCareDeliveryCheckNode } from "./care-delivery-check.node"
import { salesCareDeliveryWaitNode } from "./care-delivery-wait.node"
import { salesCareOccasionRearmNode } from "./care-occasion-rearm.node"
import { salesCareOccasionWaitNode } from "./care-occasion-wait.node"
import { salesCareOccasionNode } from "./care-occasion.node"
import { salesCarePlanDeliveryNode } from "./care-plan-delivery.node"
import { salesCarePlanOccasionsNode } from "./care-plan-occasions.node"
import { salesConsultStageNode } from "./consult-stage.node"
import { salesWebOrderKeepNode } from "./web-order-keep.node"
import { salesWebOrderLeadNode } from "./web-order-lead.node"
import { salesWebOrderNoticeNode } from "./web-order-notice.node"

/** The care and web-order nodes of slice C (`sales.after-sale` has its own spec). */
const NODES = [
    salesConsultStageNode,
    salesCarePlanDeliveryNode,
    salesCarePlanOccasionsNode,
    salesCareDeliveryWaitNode,
    salesCareDeliveryCheckNode,
    salesCareOccasionWaitNode,
    salesCareOccasionNode,
    salesCareOccasionRearmNode,
    salesWebOrderLeadNode,
    salesWebOrderKeepNode,
    salesWebOrderNoticeNode,
]

describe("the Sales care nodes", () => {
    it.each(NODES.map((node) => [node.id, node] as const))("%s conforms: every example holds", async (_id, node) => {
        expect(await checkTemplateNode(node)).toEqual([])
    })

    it("names a model only on the nodes that ask the agent", () => {
        expect(NODES.filter((node) => node.model !== undefined).map((node) => node.id)).toEqual([
            "sales.care-plan-delivery",
            "sales.care-delivery-check",
            "sales.care-occasion",
            "sales.web-order-keep",
            "sales.web-order-notice",
        ])
    })

    it("routes the two waits by their exact timing", () => {
        expect(salesCareDeliveryWaitNode.routes).toEqual({ by: "route", names: ["due", "later", "closed", "declined"] })
        expect(salesCareOccasionWaitNode.routes).toEqual({ by: "route", names: ["due", "later", "closed", "declined"] })
    })

    it("hands the delivery reading the run's own day (`ctx.run.day`), not the UTC date of its instant", async () => {
        const inputs: Array<JsonValue> = []
        const answers = [
            answered({ order: { ...ORDER_O1, delivery: { ...ORDER_O1.delivery, deliveryAt: "tomorrow" } } }),
            ...personReadsOf(answered(CARE_OPEN)).map((call) => call.answer),
            ARMED,
        ]
        let next = 0
        const context: NodeContext = {
            params: {},
            run: { id: "run-1", at: "2026-11-12T18:30:00.000Z", day: "2026-11-13", item: null, queue: [], waiting: 0 },
            subject: null,
            workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Shop" },
            tools: {
                call: () => {
                    const answer = answers[next]
                    next += 1
                    if (answer === undefined) throw new Error("unexpected call")
                    return Promise.resolve(answer)
                },
            },
            agent: {
                run: (request) => {
                    inputs.push(request.input)
                    return Promise.resolve(request.output.parse({ deliverOn: "2026-11-14" }))
                },
            },
            policy: {},
            fail: (reason): never => {
                throw new Error(JSON.stringify(reason))
            },
        }
        await salesCarePlanDeliveryNode.run({ orderId: "o1" }, context)
        expect(inputs).toEqual([{ deliveryAt: "tomorrow", today: "2026-11-13" }])
        expect(next).toBe(answers.length)
    })
})
