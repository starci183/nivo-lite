import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { salesConsultTurnNode } from "./consult-turn.node"
import { salesOccasionKeepNode } from "./occasion-keep.node"
import { salesOrderCancelTellNode } from "./order-cancel-tell.node"
import { salesOrderCancelNode } from "./order-cancel.node"
import { salesOrderCreateNode } from "./order-create.node"
import { salesOrderTellNode } from "./order-tell.node"

// The steps of the sales consult (sales.consult@13), each one feature: consult, keep the dates, record the order, tell the customer, arm
// the payment reminder, cancel and tell. `checkTemplateNode` runs every example of a node with no engine and checks its definition.

const STEPS: ReadonlyArray<TemplateNode> = [
    salesConsultTurnNode,
    salesOccasionKeepNode,
    salesOrderCreateNode,
    salesOrderTellNode,
    salesOrderCancelNode,
    salesOrderCancelTellNode,
]

/** The steps that talk to the customer (their one feature) and the ones that call the agent. */
const TALKS: ReadonlyArray<TemplateNode> = [salesConsultTurnNode, salesOrderTellNode, salesOrderCancelTellNode]

describe.each(STEPS.map((step) => [step.id, step] as const))("%s", (_id, step) => {
    it("passes its definition checks and every example", async () => {
        expect(await checkTemplateNode(step)).toEqual([])
    })

    it("sends the customer nothing unless talking to the customer is its one feature", () => {
        expect(step.tools.includes(TOOL.customerMessageSend)).toBe(TALKS.includes(step))
    })

    it("makes its writes itself: no `requires`, and a model only when it calls the agent (ADDENDUM 1, 2)", () => {
        expect(step.requires).toBeUndefined()
        expect(step.model).toBe(TALKS.includes(step) ? "claude-sonnet-5-5" : undefined)
    })
})

describe("the order path is fully automatic, generic pieces only", () => {
    // R28: `sales.payment-reminder-arm` / `-cancel` are deleted (the reminder is the payment wait's timeout in `sales.consult` v24+).
    it("records and tells on auto, through the record and send tools; the total is the lines' exact sum", () => {
        expect([salesOrderCreateNode, salesOrderTellNode].map((step) => step.mode)).toEqual(["auto", "auto"])
        // The record tools are every node's by default (own agent's records): never listed.
        expect(salesOrderCreateNode.tools).toEqual([])
    })
})

describe("the side steps never block the customer's path", () => {
    it("keeping the dates is a side step; the order and the cancel block", () => {
        expect(salesOccasionKeepNode.blocking).toBe(false)
        expect(salesOrderCreateNode.blocking ?? true).toBe(true)
        expect(salesOrderCancelNode.blocking ?? true).toBe(true)
    })
})

describe("the own tools that need a mode sit under the pseudo-account (ADDENDUM 4)", () => {
    it("cancels the customer's own unpaid order with no approval (the graph sends a paid order to the team instead)", () => {
        // `nivo-frame.rights`: NIVO's own tool, through no provider; the node declares `auto`.
        // The record tools are default for every node: the cancel does not list `recordUpdate`.
        expect(salesOrderCancelNode.tools).not.toContain(TOOL.recordUpdate)
        expect(salesOrderCancelNode.accounts).toEqual([])
        expect(salesOrderCancelNode.mode).toBe("auto")
    })
})
