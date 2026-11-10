import { runNode } from "@nivo-lite/agent-sdk/node"
import type { ZodType } from "zod"
import type { NodeModelRequest } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts } from "@nivo-lite/agent-sdk/testing"
import { coreEffects, coreTools } from "../../vocabulary"
import { TOOL } from "../../vocabulary/tool-ids"
import { salesAfterSaleNode } from "./care-after-sale.node"
import { careMemoryRowOf } from "./care.data"

/** The paid order of the live walk: the customer corrected the address and the time in the consult. */
const ORDER = {
    id: "o1",
    orderNo: "DH-20261110-0001",
    amountVnd: 1000,
    status: "paid",
    items: { lines: [] },
    leadId: "l1",
    shippedAt: null,
    confirmedAt: null,
    deliveryAddress: "12 Nguyễn Huệ Q1",
    deliveryAt: "10 giờ sáng mai",
    recipientName: "Lan",
    recipientPhone: "0900000000",
    note: "",
}

/** What the shop remembered of the customer from an earlier consult: another address and another day. */
const LEAD = { id: "l1", contactName: "An" }
const MEMORY = careMemoryRowOf("l1", { address: "57 Thạch Hãn", deliveryAt: "Ngày mốt ạ" })

describe("sales.after-sale: the order is the truth for this delivery", () => {
    it("hands the agent the order's address, recipient and time, and never the address lead memory remembers", async () => {
        const asked: Array<NodeModelRequest> = []
        const fake = fakeNodePorts({
            store: { order: [ORDER], "sales-lead": [LEAD], "agent-lead-memory": [MEMORY] },
            model: [
                { call: { tool: TOOL.customerMessageSend, args: { leadId: "l1", text: "Cảm ơn chị!" } } },
                { done: { orderId: "o1", sent: true } },
            ],
        })
        const json = fake.ports.model.json
        const ports = {
            ...fake.ports,
            model: {
                ...fake.ports.model,
                json: <S extends ZodType>(schema: S, request: NodeModelRequest) => {
                    asked.push(request)
                    return json(schema, request)
                },
            },
        }

        await runNode(
            {
                node: salesAfterSaleNode,
                params: {},
                input: { orderId: "o1", locale: "vi" },
                turn: EXAMPLE_TURN,
                grant: { rights: [...salesAfterSaleNode.rights, ...coreEffects.flatMap((effect) => effect.rights)], tools: [] },
                effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
                tools: new Map(coreTools.map((tool) => [tool.id, tool])),
                key: "after-sale:spec",
            },
            ports,
        )

        const seen = JSON.stringify(asked)
        expect(asked.length).toBeGreaterThan(0)
        expect(seen).toContain("12 Nguyễn Huệ Q1")
        expect(seen).toContain("10 giờ sáng mai")
        expect(seen).toContain("0900000000")
        expect(seen).not.toContain("57 Thạch Hãn")
        expect(seen).not.toContain("Ngày mốt")
    })
})
