import { runNode } from "@nivo-lite/agent-sdk/node"
import type { ZodType } from "zod"
import type { NodeModelRequest } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts } from "@nivo-lite/agent-sdk/testing"
import { coreEffects, coreTools } from "../../vocabulary"
import { TOOL } from "../../vocabulary/tool-ids"
import { salesConsultTurnNode } from "./consult-turn.node"

/** The customer's last order, as it was really delivered. */
const LAST_ORDER = {
    id: "o1",
    leadId: "lead-1",
    orderNo: "DH-20261110-0001",
    status: "paid",
    createdAt: "2026-11-10T08:00:00.000Z",
    recipientName: "chị Lan",
    recipientPhone: "0900000000",
    deliveryAddress: "12 Nguyễn Huệ Q1",
    deliveryAt: "10 giờ sáng mai",
    note: "",
}

/** An order of another customer: never handed over. */
const OTHER_ORDER = { ...LAST_ORDER, id: "o9", leadId: "lead-9", orderNo: "DH-9", deliveryAddress: "1 Lê Lợi" }

const ASKED = {
    branch: "asked",
    leadId: "lead-1",
    items: [],
    address: null,
    recipientName: "chị Lan",
    recipientPhone: null,
    deliveryAt: null,
}

describe("sales.consult-turn: a previous delivery resolves from the customer's orders, not from older memory", () => {
    it("hands the agent the last order's address for \"như đơn trước\", and the remembered address only as labelled background", async () => {
        const asked: Array<NodeModelRequest> = []
        const fake = fakeNodePorts({
            store: { "catalogue-item": [], message: [], order: [LAST_ORDER, OTHER_ORDER] },
            model: [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: { conversationId: "conv-1", text: "Dạ giao chị Lan ở 12 Nguyễn Huệ Q1 như đơn trước phải không ạ?" },
                    },
                },
                { done: ASKED },
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
                node: salesConsultTurnNode,
                params: {},
                input: {
                    conversationId: "conv-1",
                    text: "giao cho chị Lan như đơn trước",
                    channel: "zalo",
                    leadId: "lead-1",
                    address: "57 Thạch Hãn",
                    locale: "vi",
                },
                turn: EXAMPLE_TURN,
                grant: {
                    rights: [...salesConsultTurnNode.rights, ...coreEffects.flatMap((effect) => effect.rights)],
                    tools: salesConsultTurnNode.tools ?? [],
                },
                effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
                tools: new Map(coreTools.map((tool) => [tool.id, tool])),
                key: "consult:spec",
            },
            ports,
        )

        const seen = JSON.stringify(asked).replaceAll('\\"', '"')
        expect(seen).toContain('"recentOrders":[{"orderNo":"DH-20261110-0001"')
        expect(seen).toContain('"deliveryAddress":"12 Nguyễn Huệ Q1"')
        expect(seen).toContain('"recipientName":"chị Lan"')
        expect(seen).toContain('"remembered":{"address":"57 Thạch Hãn"}')
        expect(seen).not.toContain('"address":"57 Thạch Hãn","')
        expect(seen).not.toContain("1 Lê Lợi")
    })

    it("hands every recent order, newest first, when they disagree on the address, so the agent can say which one it took", async () => {
        const asked: Array<NodeModelRequest> = []
        const older = { ...LAST_ORDER, id: "o0", orderNo: "DH-20261110-0001", createdAt: "2026-11-10T07:00:00.000Z" }
        const newer = {
            ...LAST_ORDER,
            id: "o2",
            orderNo: "DH-20261110-0002",
            createdAt: "2026-11-10T09:00:00.000Z",
            deliveryAddress: "57 thạch hãn",
        }
        const fake = fakeNodePorts({
            store: { "catalogue-item": [], message: [], order: [newer, older] },
            model: [
                {
                    call: {
                        tool: TOOL.customerMessageSend,
                        args: {
                            conversationId: "conv-1",
                            text: "Dạ em giao 57 thạch hãn như đơn gần nhất DH-20261110-0002 nhé, đơn DH-20261110-0001 giao 12 Nguyễn Huệ Q1 ạ?",
                        },
                    },
                },
                { done: ASKED },
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
                node: salesConsultTurnNode,
                params: {},
                input: { conversationId: "conv-1", text: "như đơn trước", channel: "zalo", leadId: "lead-1", address: null, locale: "vi" },
                turn: EXAMPLE_TURN,
                grant: {
                    rights: [...salesConsultTurnNode.rights, ...coreEffects.flatMap((effect) => effect.rights)],
                    tools: salesConsultTurnNode.tools ?? [],
                },
                effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
                tools: new Map(coreTools.map((tool) => [tool.id, tool])),
                key: "consult:disagree",
            },
            ports,
        )

        const seen = JSON.stringify(asked).replaceAll('\\"', '"')
        const first = seen.indexOf('"deliveryAddress":"57 thạch hãn"')
        const second = seen.indexOf('"deliveryAddress":"12 Nguyễn Huệ Q1"')
        expect(first).toBeGreaterThan(-1)
        expect(second).toBeGreaterThan(first)
    })
})
