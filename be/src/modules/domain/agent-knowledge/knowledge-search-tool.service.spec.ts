import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { KnowledgeRecallService } from "./knowledge-recall.service"
import { KnowledgeSearchToolService } from "./knowledge-search-tool.service"

const WS = "11111111-1111-4111-8111-111111111111"
const ctx = { jobId: "j1", workspaceId: WS, conversationId: "c1" }

const build = async (workspaceId: string) => {
    const conversations = {
        turnOf: jest.fn().mockResolvedValue({
            kind: "ok",
            value: { workspaceId, installationId: "i1", agent: { module: "booking" } },
        }),
    }
    const recall = {
        recall: jest.fn().mockResolvedValue({ brief: "BRIEF", passages: [{ title: "Menu", topic: null }], facts: [] }),
    }
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSearchToolService,
            { provide: AgentConversationsService, useValue: mock<AgentConversationsService>(conversations) },
            { provide: KnowledgeRecallService, useValue: mock<KnowledgeRecallService>(recall) },
        ],
    }).compile()
    return { tool: moduleRef.get(KnowledgeSearchToolService), recall }
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
