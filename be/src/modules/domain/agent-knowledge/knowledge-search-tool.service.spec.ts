import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { McpCallLogService } from "@modules/domain/mcp-call-log"
import { CLOCK } from "@modules/platform/clock"
import { KnowledgeRecallService } from "./knowledge-recall.service"
import { KnowledgeSearchToolService } from "./knowledge-search-tool.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ctx = { workspaceId: WS, conversationId: "c1", agentId: null }

const build = async (workspaceId: string) => {
    const conversations = {
        turnOf: jest.fn().mockResolvedValue({
            kind: "ok",
            value: { workspaceId, installationId: "i1", agent: { module: "booking" } },
        }),
    }
    const recall = {
        standingMemory: jest.fn().mockResolvedValue("### Delivery\n- Days: Sunday"),
        recall: jest.fn().mockResolvedValue({ brief: "BRIEF", passages: [{ title: "Menu", topic: null }], facts: [] }),
    }
    const callLog = mock<McpCallLogService>({ append: jest.fn(() => Promise.resolve()) })
    const agents = mock<AgentDirectoryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSearchToolService,
            { provide: AgentConversationsService, useValue: mock<AgentConversationsService>(conversations) },
            { provide: KnowledgeRecallService, useValue: mock<KnowledgeRecallService>(recall) },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: McpCallLogService, useValue: callLog },
            { provide: CLOCK, useValue: new FakeClock("2026-11-01T00:00:00.000Z") },
        ],
    }).compile()
    return { tool: moduleRef.get(KnowledgeSearchToolService), recall, callLog, agents }
}

describe("KnowledgeSearchToolService", () => {
    it("searches the public view of the conversation's own agent and instance", async () => {
        const { tool, recall } = await build(WS)
        const found = await tool.search(ctx, "price")
        expect(found).toEqual({ passages: "BRIEF", citations: [{ title: "Menu", topic: "" }] })
        expect(recall.recall).toHaveBeenCalledWith(
            { workspaceId: WS, module: "booking", audience: "customer", installationId: "i1" },
            "price",
            expect.any(Object),
        )
    })

    it("logs every read in the audit, with the query masked", async () => {
        const { tool, callLog } = await build(WS)
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
        const { tool, callLog } = await build(WS)
        callLog.append.mockRejectedValue(new Error("log down"))
        await expect(tool.memory(ctx)).rejects.toThrow("log down")
    })

    it("reads the memory through the customer view in a conversation and audits it", async () => {
        const { tool, recall, callLog } = await build(WS)
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
        const { tool, recall, agents } = await build(WS)
        agents.turnFactsOf.mockResolvedValue(
            mock<NonNullable<Awaited<ReturnType<AgentDirectoryService["turnFactsOf"]>>>>({ module: "sales" }),
        )
        await tool.memory({ workspaceId: WS, conversationId: null, agentId: "a1" })
        expect(recall.standingMemory).toHaveBeenCalledWith(
            expect.objectContaining({ module: "sales", audience: "internal" }),
        )
    })

    it("never reads another tenant's instance", async () => {
        const { tool, recall } = await build("22222222-2222-4222-8222-222222222222")
        await tool.search(ctx, "price")
        expect(recall.recall).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: WS, module: "chatbot", installationId: null }),
            "price",
            expect.any(Object),
        )
    })
})
