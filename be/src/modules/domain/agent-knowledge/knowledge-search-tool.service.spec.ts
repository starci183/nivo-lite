import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ChatConversationsService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatTurnConversation } from "@modules/domain/chat-records"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { CLOCK } from "@modules/platform/clock"
import { refused } from "@modules/platform/primitives"
import { KnowledgeRecallService } from "./knowledge-recall.service"
import { KnowledgeSearchToolService } from "./knowledge-search-tool.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ctx = { workspaceId: WS, conversationId: "c1", agentId: null }

const turnOf = builder<ChatTurnConversation>({
    id: "c1",
    workspaceId: WS,
    channel: "website",
    externalId: null,
    connectionId: null,
    leadId: null,
    handledBy: null,
    visitorName: null,
    installationId: "i1",
    speaksAs: null,
    agent: {
        id: "a-booking",
        name: "Booking",
        handle: "booking",
        role: "booking",
        module: "booking",
        instructions: "",
        knowledge: "",
        approvalRule: "",
        greeting: "",
    },
})

const build = async () => {
    const conversations = mock<ChatConversationsService>({
        turnOf: jest.fn().mockResolvedValue({
            kind: "ok",
            value: turnOf(),
        }),
    })
    const recall = {
        standingMemory: jest.fn().mockResolvedValue("### Delivery\n- Days: Sunday"),
        recall: jest.fn().mockResolvedValue({ brief: "BRIEF", passages: [{ title: "Menu", topic: null }], facts: [] }),
    }
    const callLog = mock<McpCallLogService>({ append: jest.fn(() => Promise.resolve()) })
    const agents = mock<AgentDirectoryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSearchToolService,
            { provide: ChatConversationsService, useValue: conversations },
            { provide: KnowledgeRecallService, useValue: mock<KnowledgeRecallService>(recall) },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: McpCallLogService, useValue: callLog },
            { provide: CLOCK, useValue: new FakeClock("2026-11-01T00:00:00.000Z") },
        ],
    }).compile()
    return { tool: moduleRef.get(KnowledgeSearchToolService), conversations, recall, callLog, agents }
}

describe("KnowledgeSearchToolService", () => {
    it("searches the public view of the conversation's own agent and instance", async () => {
        const { tool, recall } = await build()
        const found = await tool.search(ctx, "price")
        expect(found).toEqual({ passages: "BRIEF", citations: [{ title: "Menu", topic: "" }] })
        expect(recall.recall).toHaveBeenCalledWith(
            { workspaceId: WS, module: "booking", audience: "customer", installationId: "i1" },
            "price",
            expect.any(Object),
        )
    })

    it("logs every read in the audit, with the query masked", async () => {
        const { tool, callLog } = await build()
        await tool.search({ ...ctx, agentId: "a1" }, "price")
        expect(callLog.append).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: WS,
                connector: "nivo",
                tool: "knowledge.search",
                agentId: "a1",
                conversationId: "c1",
                argsMaskedJson: '{"query_chars":5}',
                outcome: "ok",
            }),
        )
    })

    it("answers no read it could not audit", async () => {
        const { tool, callLog } = await build()
        callLog.append.mockRejectedValue(new Error("log down"))
        await expect(tool.memory(ctx)).rejects.toThrow("log down")
    })

    it("reads the memory through the customer view in a conversation and audits it", async () => {
        const { tool, recall, callLog } = await build()
        await expect(tool.memory(ctx)).resolves.toBe("### Delivery\n- Days: Sunday")
        expect(recall.standingMemory).toHaveBeenCalledWith({
            workspaceId: WS,
            module: "booking",
            audience: "customer",
            installationId: "i1",
        })
        expect(callLog.append).toHaveBeenCalledWith(expect.objectContaining({ tool: "memory.read", outcome: "ok" }))
    })

    it("reads as its own agent in a turn with no conversation", async () => {
        const { tool, recall, agents } = await build()
        agents.turnFactsOf.mockResolvedValue(
            mock<NonNullable<Awaited<ReturnType<AgentDirectoryService["turnFactsOf"]>>>>({ module: "sales" }),
        )
        await tool.memory({ workspaceId: WS, conversationId: null, agentId: "a1" })
        expect(recall.standingMemory).toHaveBeenCalledWith(
            expect.objectContaining({ module: "sales", audience: "internal" }),
        )
    })

    it("never reads the instance of a conversation the workspace does not hold", async () => {
        const { tool, recall, conversations } = await build()
        conversations.turnOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))
        await tool.search(ctx, "price")
        expect(conversations.turnOf).toHaveBeenCalledWith(WS, "c1")
        expect(recall.recall).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: WS, module: "chatbot", installationId: null }),
            "price",
            expect.any(Object),
        )
    })
})

describe("KnowledgeSearchToolService > read failure audit", () => {
    it("audits a failed search without recording the query and rethrows the actual failure", async () => {
        const { tool, recall, callLog } = await build()
        const failure = new Error("recall unavailable")
        recall.recall.mockRejectedValue(failure)

        await expect(tool.search(ctx, "price")).rejects.toBe(failure)

        expect(callLog.append).toHaveBeenCalledTimes(1)
        expect(callLog.append).toHaveBeenCalledWith({
            workspaceId: WS,
            connector: "nivo",
            tool: "knowledge.search",
            agentId: "a-booking",
            conversationId: "c1",
            workItemId: null,
            argsMaskedJson: '{"query_chars":5}',
            argsHash: "683b531f41ec88a2f345b727afe59757b73162a340a65c86bba62866f8fe556c",
            outcome: "error",
            errorCode: "read_failed",
            resultSummary: "",
            durationMs: 0,
            approvedBy: null,
        })
    })

    it("fails closed when the audit of a failed read also cannot be written", async () => {
        const { tool, recall, callLog } = await build()
        const auditFailure = new Error("audit unavailable")
        recall.standingMemory.mockRejectedValue(new Error("memory unavailable"))
        callLog.append.mockRejectedValue(auditFailure)

        await expect(tool.memory(ctx)).rejects.toBe(auditFailure)

        expect(callLog.append).toHaveBeenCalledTimes(1)
        expect(callLog.append).toHaveBeenCalledWith(
            expect.objectContaining({
                tool: "memory.read",
                outcome: "error",
                errorCode: "read_failed",
                resultSummary: "",
            }),
        )
    })
})

describe("KnowledgeSearchToolService > missing read identities", () => {
    it("uses the customer default view without looking up an absent agent or conversation", async () => {
        const { tool, recall, agents, conversations, callLog } = await build()

        await expect(tool.memory({ workspaceId: WS, conversationId: null, agentId: null })).resolves.toBe(
            "### Delivery\n- Days: Sunday",
        )

        expect(recall.standingMemory).toHaveBeenCalledWith({
            workspaceId: WS,
            module: "chatbot",
            audience: "customer",
            installationId: null,
        })
        expect(agents.turnFactsOf).not.toHaveBeenCalled()
        expect(conversations.turnOf).not.toHaveBeenCalled()
        expect(callLog.append).toHaveBeenCalledWith(expect.objectContaining({ agentId: null, conversationId: null }))
    })

    it("never widens a search without caller identities to internal knowledge", async () => {
        const { tool, recall, agents, conversations, callLog } = await build()
        await expect(tool.search({ workspaceId: WS, conversationId: null, agentId: null }, "price")).resolves.toEqual({
            passages: "BRIEF",
            citations: [{ title: "Menu", topic: "" }],
        })
        expect(recall.recall).toHaveBeenCalledWith(
            { workspaceId: WS, module: "chatbot", audience: "customer", installationId: null },
            "price",
            { facts: 6, passages: 6, budget: 3000 },
        )
        expect(recall.recall).not.toHaveBeenCalledWith(
            expect.objectContaining({ audience: "internal" }),
            "price",
            expect.anything(),
        )
        expect(agents.turnFactsOf).not.toHaveBeenCalled()
        expect(conversations.turnOf).not.toHaveBeenCalled()
        expect(callLog.append).toHaveBeenCalledWith(expect.objectContaining({ agentId: null, conversationId: null }))
    })

    it("uses no installation or agent identity when the conversation owner refuses it", async () => {
        const { tool, recall, conversations, callLog } = await build()
        conversations.turnOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))

        await expect(tool.memory(ctx)).resolves.toBe("### Delivery\n- Days: Sunday")

        expect(recall.standingMemory).toHaveBeenCalledWith({
            workspaceId: WS,
            module: "chatbot",
            audience: "customer",
            installationId: null,
        })
        expect(callLog.append).toHaveBeenCalledWith(expect.objectContaining({ agentId: null, conversationId: "c1" }))
    })
})
