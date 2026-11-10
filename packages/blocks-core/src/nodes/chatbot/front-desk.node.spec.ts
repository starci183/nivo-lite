import { isNodeConfused, runNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { RightsGrant } from "@nivo-lite/agent-sdk/rights"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import type { FakeNodePortsOptions } from "@nivo-lite/agent-sdk/testing"
import { coreEffects, coreTools } from "../../vocabulary"
import { brainSearchTool } from "../../vocabulary/tools"
import { TOOL } from "../../vocabulary/tool-ids"
import { SEARCH_HIT, SEARCH_MISS, chatbotAnswerNode } from "./answer.node"
import { chatbotComplaintNode } from "./complaint.node"
import { frontDeskSample } from "./front-desk.copy"
import { threadLinesOf } from "./front-desk.policy"
import { chatbotUnderstandNode } from "./understand.node"

const runOf = (node: NodeDefinition, input: unknown, options: FakeNodePortsOptions, grant?: RightsGrant) => {
    const fake = fakeNodePorts(options)
    const json = jest.spyOn(fake.ports.model, "json")
    const ran = runNode(
        {
            node,
            params: {},
            input,
            turn: EXAMPLE_TURN,
            grant: grant ?? { rights: node.rights, tools: node.tools ?? [] },
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(coreTools.map((tool) => [tool.id, tool])),
            key: "k",
        },
        fake.ports,
    )
    return { fake, json, ran }
}

/** Whether the run ended confused, the engine's to take over. */
const confusedOf = (ran: Promise<unknown>): Promise<boolean> =>
    ran.then(
        () => false,
        (cause: unknown) => isNodeConfused(cause),
    )

const CONFUSION = { reason: frontDeskSample("confusedReason"), question: frontDeskSample("confusedQuestion") }

describe("chatbot.understand", () => {
    it.each(chatbotUnderstandNode.examples)("holds its example: $name", async (example) => {
        await expect(nodeExampleMismatches(chatbotUnderstandNode, example, coreEffects, coreTools)).resolves.toEqual([])
    })

    it("is a pure decision: a condition with no effect and no tool", () => {
        expect(chatbotUnderstandNode.role).toBe("condition")
        expect(chatbotUnderstandNode.effects).toEqual([])
        expect(chatbotUnderstandNode.tools ?? []).toEqual([])
    })

    it("ends the step confused when the AI cannot tell, and routes nowhere", async () => {
        const { ran } = runOf(
            chatbotUnderstandNode,
            { conversationId: "c1", text: frontDeskSample("maDon") },
            { model: [{ confused: CONFUSION }] },
        )

        await expect(confusedOf(ran)).resolves.toBe(true)
    })

    it("shows the model the pictures the customer sent, a receipt included", async () => {
        const { json, ran } = runOf(
            chatbotUnderstandNode,
            {
                conversationId: "c1",
                text: frontDeskSample("daChuyen"),
                messages: [
                    {
                        text: frontDeskSample("daChuyen"),
                        attachments: [{ name: "bill.jpg", contentType: "image/jpeg", url: "https://files.example/bill.jpg" }],
                    },
                ],
            },
            { model: [{ answer: { branch: "paid", summary: frontDeskSample("summaryPaid") } }] },
        )
        await expect(ran).resolves.toMatchObject({ output: { branch: "paid" } })
        expect(json.mock.calls.flatMap(([, request]) => request.images ?? [])).toEqual(["https://files.example/bill.jpg"])
    })
})

describe("chatbot.answer", () => {
    it.each(chatbotAnswerNode.examples)("holds its example: $name", async (example) => {
        await expect(nodeExampleMismatches(chatbotAnswerNode, example, coreEffects, coreTools)).resolves.toEqual([])
    })

    it("may only send to the customer, and must have sent", () => {
        expect(chatbotAnswerNode.effects).toEqual([TOOL.customerMessageSend])
        expect(chatbotAnswerNode.tools).toEqual([TOOL.brainSearch])
        expect(chatbotAnswerNode.requires).toEqual([TOOL.customerMessageSend])
    })

    it("refuses an answer that sent nothing, and ends confused when the agent never sends", async () => {
        const { fake, ran } = runOf(
            chatbotAnswerNode,
            { conversationId: "c1", text: frontDeskSample("gioMoCua") },
            {
                model: [
                    { done: { reply: frontDeskSample("faqReply") } },
                    { done: { reply: frontDeskSample("faqReply") } },
                    { done: { reply: frontDeskSample("faqReply") } },
                    { done: { reply: frontDeskSample("faqReply") } },
                ],
            },
        )

        await expect(confusedOf(ran)).resolves.toBe(true)
        expect(fake.executed).toEqual([])
    })

    it("hands a question the search does not answer to the engine, sending nothing made up", async () => {
        const { fake, ran } = runOf(
            chatbotAnswerNode,
            { conversationId: "c1", text: frontDeskSample("unanswered") },
            {
                tools: [SEARCH_MISS],
                model: [
                    { call: { tool: TOOL.brainSearch, args: { query: frontDeskSample("unanswered") } } },
                    { confused: CONFUSION },
                ],
            },
        )

        await expect(confusedOf(ran)).resolves.toBe(true)
        expect(fake.executed).toEqual([])
    })

    it("holds the canned search answers to the real tool's result: notice, facts, passages of sourceId, title, topic, order, content", () => {
        for (const hit of [SEARCH_HIT, SEARCH_MISS]) {
            expect(brainSearchTool.result.safeParse(hit).success).toBe(true)
            expect(Object.keys(hit).toSorted()).toEqual(["facts", "notice", "passages"])
        }
        expect(Object.keys(SEARCH_HIT.passages[0] ?? {}).toSorted()).toEqual(["content", "order", "sourceId", "title", "topic"])
    })

    it("gets knowledge only by the search tool: no document is handed over as data", async () => {
        const { json, ran } = runOf(
            chatbotAnswerNode,
            { conversationId: "c1", text: frontDeskSample("gioMoCua") },
            { model: [{ confused: CONFUSION }] },
        )
        await expect(confusedOf(ran)).resolves.toBe(true)
        expect(JSON.stringify(json.mock.calls[0]?.[1].input)).not.toContain("documents")
        expect(chatbotAnswerNode.rights.map((right) => right.kind)).toEqual(["message"])
    })
})

describe("chatbot.complaint", () => {
    it.each(chatbotComplaintNode.examples)("holds its example: $name", async (example) => {
        await expect(nodeExampleMismatches(chatbotComplaintNode, example, coreEffects, coreTools)).resolves.toEqual([])
    })

    it("may only reply to the customer and tell the team, and must have done both", () => {
        expect(chatbotComplaintNode.effects).toEqual([TOOL.customerMessageSend, TOOL.teamMessagePost])
        expect(chatbotComplaintNode.tools ?? []).toEqual([])
        expect(chatbotComplaintNode.requires).toEqual([TOOL.customerMessageSend, TOOL.teamMessagePost])
    })

    it("refuses to finish after the customer reply alone: the team must be told", async () => {
        const [example] = chatbotComplaintNode.examples
        const [reply, , done] = example.model ?? []
        const { fake, ran } = runOf(
            chatbotComplaintNode,
            example.input,
            { model: [reply, done, done, done, done] },
            example.grant,
        )

        await expect(confusedOf(ran)).resolves.toBe(true)
        expect(fake.executed.map((effect) => effect.id)).toEqual([TOOL.customerMessageSend])
    })
})

describe("threadLinesOf", () => {
    it("keeps the customer's and the shop's lines, oldest first, and leaves the system out", () => {
        expect(
            threadLinesOf([
                { role: "agent", text: frontDeskSample("shopAsk"), sentAt: "2026-11-09T10:01:00Z" },
                { role: "user", text: frontDeskSample("hoaHeo"), sentAt: "2026-11-09T10:00:00Z" },
                { role: "system", text: "joined", sentAt: "2026-11-09T09:59:00Z" },
            ]),
        ).toEqual([`customer: ${frontDeskSample("hoaHeo")}`, `shop: ${frontDeskSample("shopAsk")}`])
    })
})
