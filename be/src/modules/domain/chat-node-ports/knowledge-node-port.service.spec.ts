import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentDirectoryService } from "@modules/domain/agents"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { KnowledgeSourcesReadableService } from "@modules/domain/knowledge-sources"
import { KnowledgeNodePortService } from "./knowledge-node-port.service"

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "c1",
    locale: "vi",
}

/** The agent that speaks in the turn conversation. */
const TURN_AGENT = {
    id: "agent-1",
    name: "Chatbot",
    handle: "chatbot",
    role: "Customer chat",
    module: "chatbot",
    instructions: "Be kind",
    knowledge: "Tea",
    approvalRule: "ask",
    greeting: "Hi",
}

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const conversations = mock<AgentConversationsService>()
    const sources = mock<KnowledgeSourcesReadableService>()
    const agents = mock<AgentDirectoryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeNodePortService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: KnowledgeSourcesReadableService, useValue: sources },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { port: moduleRef.get(KnowledgeNodePortService), registry, conversations, sources, agents }
}

describe("KnowledgeNodePortService", () => {
    const documents = [
        {
            id: "d1",
            title: "Price",
            topic: null,
            kind: "text",
            visibility: "public" as const,
            updatedAt: "",
            content: "120k",
        },
        {
            id: "d2",
            title: "Capital",
            topic: null,
            kind: "text",
            visibility: "internal" as const,
            updatedAt: "",
            content: "60k",
        },
    ]

    it("gives a turn read the customer view: public documents of the module and installation of the agent", async () => {
        const { port, agents, conversations, sources } = await build()
        agents.turnFactsOf.mockResolvedValue(TURN_AGENT)
        conversations.installationIdOf.mockResolvedValue("inst-1")
        sources.readableFor.mockResolvedValue(documents.slice(0, 1))

        await expect(
            port.read(TURN, { where: { visibility: "public" }, fields: ["id", "body"] }, "turn"),
        ).resolves.toEqual([{ id: "d1", body: "120k" }])
        expect(sources.readableFor).toHaveBeenCalledWith(
            { workspaceId: "ws-1", module: "chatbot", installationId: "inst-1", audience: "customer" },
            50,
        )
    })

    it("opens the internal documents only to a workspace read, and asks for no installation without a conversation", async () => {
        const { port, agents, sources } = await build()
        agents.turnFactsOf.mockResolvedValue(TURN_AGENT)
        sources.readableFor.mockResolvedValue(documents)

        await expect(
            port.read(
                { ...TURN, conversationId: null },
                { where: { visibility: "internal" }, fields: ["id"] },
                "workspace",
            ),
        ).resolves.toEqual([{ id: "d2" }])
        expect(sources.readableFor).toHaveBeenCalledWith(
            { workspaceId: "ws-1", module: "chatbot", installationId: null, audience: "internal" },
            50,
        )
    })

    it("reads nothing when the agent of the turn is gone", async () => {
        const { port, agents, sources } = await build()
        agents.turnFactsOf.mockResolvedValue(null)

        await expect(port.read(TURN, { fields: ["id"] }, "turn")).resolves.toEqual([])
        expect(sources.readableFor).not.toHaveBeenCalled()
    })

    it("registers itself with the graph-nodes registry", async () => {
        const { port, registry } = await build()
        port.onModuleInit()
        expect(registry.addDataPort.mock.calls.map(([registered]) => registered.kind)).toEqual(["knowledge-document"])
    })
})
