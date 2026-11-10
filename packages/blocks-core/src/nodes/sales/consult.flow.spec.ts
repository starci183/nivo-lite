import { isNodeConfused, runNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import type { FakeNodePortsOptions } from "@nivo-lite/agent-sdk/testing"
import { coreEffects, coreTools } from "../../vocabulary"
import { TOOL } from "../../vocabulary/tool-ids"
import { salesCreateOrderNode } from "../order/create.node"
import { paymentRequestNode } from "../payment/request.node"
import { brainSearchTool } from "../../vocabulary/tools"
import { BRAIN_ANSWER as BRAIN_HIT, salesConsultTurnNode } from "./consult-turn.node"
import { salesOrderNoticeNode } from "./order-notice.node"

// The five steps of the sales consult (Tư vấn khách → Tạo đơn → Gửi QR thanh toán → Báo đội đơn mới → Chốt mua): each acting step is an
// Agent + MCP step, scripted here as the transcript the SDK fake plays.

const STEPS: ReadonlyArray<NodeDefinition> = [
    salesConsultTurnNode,
    salesCreateOrderNode,
    paymentRequestNode,
    salesOrderNoticeNode,
]

/** Runs a step as the host does, over the fake ports, under the node's own rights and every effect and tool installed. */
const runOver = async (node: NodeDefinition, input: unknown, options: FakeNodePortsOptions) => {
    const fake = fakeNodePorts(options)
    try {
        const run = await runNode(
            {
                node,
                params: {},
                input,
                turn: EXAMPLE_TURN,
                grant: {
                    rights: [...node.rights, ...coreEffects.flatMap((effect) => effect.rights)],
                    tools: node.tools ?? [],
                },
                effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
                tools: new Map(coreTools.map((tool) => [tool.id, tool])),
                key: `${node.id}:spec`,
            },
            fake.ports,
        )
        return { output: run.output, confused: null, executed: fake.executed }
    } catch (cause) {
        if (!isNodeConfused(cause)) throw cause
        return { output: null, confused: cause, executed: fake.executed }
    }
}

describe.each(STEPS.map((node) => [node.id, node] as const))("%s", (_id, node) => {
    it.each(node.examples.map((example) => [example.name, example] as const))("example: %s", async (_name, example) => {
        await expect(nodeExampleMismatches(node, example, coreEffects, coreTools)).resolves.toEqual([])
    })

    it("has no failure branch and no failure shape: what it cannot do goes to the engine wrapper", () => {
        expect(node.failure).toBeUndefined()
        expect(node.effects).not.toContain(TOOL.workItemRaise)
    })
})

describe("sales.consult-turn", () => {
    it("routes on ready or asked only; asked carries no route, so the turn ends and the conversation is kept", () => {
        expect(salesConsultTurnNode.role).toBe("execute")
        expect(
            salesConsultTurnNode.output.safeParse({
                branch: "asked",
                leadId: null,
                items: [],
                address: null,
                recipientName: null,
                recipientPhone: null,
                deliveryAt: null,
            }).success,
        ).toBe(true)
    })

    it("refuses a ready draft without an item, an address, the recipient's phone, the delivery time or the customer", () => {
        const draft = {
            branch: "ready",
            leadId: "lead-1",
            items: [{ catalogueItemId: "c1", quantity: 1 }],
            address: "x",
            recipientName: null,
            recipientPhone: "0901 234 567",
            deliveryAt: "Saturday 9-11",
        }

        expect(salesConsultTurnNode.output.safeParse(draft).success).toBe(true)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, recipientName: "Lan" }).success).toBe(true)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, address: null }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, recipientPhone: null }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, deliveryAt: null }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, items: [] }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, leadId: null }).success).toBe(false)
    })

    it("searches the shop's knowledge with the second brain's tool and reads no document as data", () => {
        expect(salesConsultTurnNode.tools).toEqual([TOOL.brainSearch, TOOL.leadOrderList])
        expect(salesConsultTurnNode.rights.map((right) => right.kind)).not.toContain("knowledge-document")
        expect(brainSearchTool.result.safeParse(BRAIN_HIT).success).toBe(true)
        expect(Object.keys(BRAIN_HIT).toSorted()).toEqual(["facts", "notice", "passages"])
        expect(Object.keys(BRAIN_HIT.passages[0] ?? {}).toSorted()).toEqual([
            "content",
            "order",
            "sourceId",
            "title",
            "topic",
        ])
    })
})

describe("sales.create-order", () => {
    const draft = {
        leadId: "lead-1",
        items: [{ catalogueItemId: "c1", quantity: 2 }],
        address: "25 Nguyen Hue",
        recipientName: null,
        recipientPhone: "0901 234 567",
        deliveryAt: "Saturday 9-11",
        conversationId: "conv-1",
    }
    const record = {
        call: {
            tool: TOOL.orderRecord,
            args: {
                leadId: "lead-1",
                items: [{ catalogueItemId: "c1", qty: 2 }],
                address: "25 Nguyen Hue",
                recipientPhone: "0901 234 567",
                deliveryAt: "Saturday 9-11",
            },
        },
    }
    const confirm = { call: { tool: TOOL.orderConfirm, args: { orderId: "order-1" } } }

    it("a big order that waits for the owner: one holding line, then the step is not done and goes to the wrapper", async () => {
        const waits = {
            kind: "refused",
            id: "waits_owner",
            facts: { orderId: "order-1", orderNo: "DH-1", amountVnd: 6_000_000, thresholdVnd: 5_000_000 },
        }
        const ran = await runOver(salesCreateOrderNode, draft, {
            answers: { [TOOL.orderRecord]: [{ kind: "order", id: "order-1" }], [TOOL.orderConfirm]: [waits] },
            model: [
                record,
                confirm,
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { conversationId: "conv-1", text: "We are checking your order and will be right back." },
                    },
                },
                { confused: { reason: "order DH-1 waits for the owner's approval", question: "Approve order DH-1?" } },
            ],
        })

        expect(ran.confused).not.toBeNull()
        expect(ran.executed.map((call) => call.id)).toEqual([
            TOOL.orderRecord,
            TOOL.orderConfirm,
            TOOL.customerMessageSend,
        ])
    })

    it("refuses an output before both order calls succeeded", async () => {
        const ran = await runOver(salesCreateOrderNode, draft, {
            answers: { [TOOL.orderRecord]: [{ kind: "order", id: "order-1" }] },
            model: [
                record,
                { done: { orderId: "order-1", orderNo: "DH-1" } },
                { confused: { reason: "the order is not confirmed", question: null } },
            ],
        })

        expect(ran.confused).not.toBeNull()
    })

    it("takes ids and quantities only: no price, total or amount in what it is given", () => {
        expect(Object.keys(salesCreateOrderNode.input.parse(draft) as object).sort()).toEqual(
            ["address", "conversationId", "deliveryAt", "items", "leadId", "recipientName", "recipientPhone"].sort(),
        )
    })
})

describe("payment.request", () => {
    // Waits for F2's `nivo.payment.qr.create` effect ({ orderId }): until it is installed the runner refuses the undeclared effect.
    it("no payment account connected: a holding line, then the step is not done and goes to the wrapper", async () => {
        const ran = await runOver(
            paymentRequestNode,
            { orderId: "order-1", conversationId: "conv-1", locale: "vi" },
            {
                answers: { [TOOL.paymentQrCreate]: [{ kind: "refused", id: "no_payment_account" }] },
                model: [
                    { call: { tool: TOOL.paymentQrCreate, args: { orderId: "order-1" } } },
                    {
                        call: {
                            tool: TOOL.customerMessageSend,
                            args: { conversationId: "conv-1", text: "The shop will send the payment details shortly." },
                        },
                    },
                    { confused: { reason: "no payment account connected", question: "Connect a bank account?" } },
                ],
            },
        )

        expect(ran.confused).not.toBeNull()
        expect(ran.executed.map((call) => call.id)).toEqual([TOOL.paymentQrCreate, TOOL.customerMessageSend])
    })
})
