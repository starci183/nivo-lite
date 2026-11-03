import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { AgentDirectoryService } from "@modules/domain/agents"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { KnowledgeSourcesReadableService } from "@modules/domain/knowledge-sources"
import { ConversationNodePortService } from "./conversation-node-port.service"
import { KnowledgeNodePortService } from "./knowledge-node-port.service"
import { MessageNodePortService } from "./message-node-port.service"

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "c1",
    locale: "vi",
}

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    const sources = mock<KnowledgeSourcesReadableService>()
    const agents = mock<AgentDirectoryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConversationNodePortService,
            MessageNodePortService,
            KnowledgeNodePortService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: KnowledgeSourcesReadableService, useValue: sources },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return {
        conversationPort: moduleRef.get(ConversationNodePortService),
        messagePort: moduleRef.get(MessageNodePortService),
        knowledgePort: moduleRef.get(KnowledgeNodePortService),
        registry,
        conversations,
        messages,
        sources,
        agents,
    }
}

describe("the data ports of the chat", () => {
    it("register themselves with the graph-nodes registry", async () => {
        const { conversationPort, messagePort, knowledgePort, registry } = await build()
        conversationPort.onModuleInit()
        messagePort.onModuleInit()
        knowledgePort.onModuleInit()
        expect(registry.addDataPort.mock.calls.map(([port]) => port.kind)).toEqual([
            "conversation",
            "message",
            "knowledge-document",
        ])
    })
})

describe("ConversationNodePortService", () => {
    it("reads the conversation of the turn with its status and last message, cut to the fields", async () => {
        const { conversationPort, conversations, messages } = await build()
        conversations.nodeRows.mockResolvedValue([
            { id: "c1", leadId: "l1", channel: "zalo", handledBy: "Lan" },
            { id: "c1", leadId: null, channel: "web", handledBy: null },
        ])
        messages.latestAt.mockResolvedValueOnce(new Date(1000)).mockResolvedValueOnce(null)

        const rows = await conversationPort.read(TURN, { fields: ["id", "status", "lastMessageAt"] }, "turn")

        expect(rows).toEqual([
            { id: "c1", status: "with_person", lastMessageAt: "1970-01-01T00:00:01.000Z" },
            { id: "c1", status: "agent", lastMessageAt: null },
        ])
        expect(conversations.nodeRows).toHaveBeenCalledWith("ws-1", expect.objectContaining({ id: "c1" }), 50)
    })

    it("reaches nothing on a turn read when the turn serves no conversation or another one is asked", async () => {
        const { conversationPort, conversations } = await build()

        await expect(
            conversationPort.read({ ...TURN, conversationId: null }, { fields: ["id"] }, "turn"),
        ).resolves.toEqual([])
        await expect(conversationPort.read(TURN, { where: { id: "c2" }, fields: ["id"] }, "turn")).resolves.toEqual([])
        expect(conversations.nodeRows).not.toHaveBeenCalled()
    })

    it("reaches the workspace on a workspace read, narrowed by where", async () => {
        const { conversationPort, conversations, messages } = await build()
        conversations.nodeRows.mockResolvedValue([
            { id: "c9", leadId: "l1", channel: "zalo", handledBy: null },
            { id: "c8", leadId: "l1", channel: "zalo", handledBy: "Lan" },
        ])
        messages.latestAt.mockResolvedValue(null)

        const rows = await conversationPort.read(
            { ...TURN, conversationId: null },
            { where: { leadId: "l1", channel: "zalo", status: "agent" }, fields: ["id"], limit: 5 },
            "workspace",
        )

        expect(rows).toEqual([{ id: "c9" }])
        expect(conversations.nodeRows).toHaveBeenCalledWith("ws-1", { id: undefined, leadId: "l1", channel: "zalo" }, 5)
    })
})

describe("MessageNodePortService", () => {
    const stored = [
        { id: "m2", conversationId: "c1", authorKind: "agent", body: "b", createdAt: "2026-01-02T00:00:00.000Z" },
        { id: "m1", conversationId: "c1", authorKind: "user", body: "a", createdAt: "2026-01-01T00:00:00.000Z" },
    ]

    it("reads the messages of the conversation of the turn, cut to the fields", async () => {
        const { messagePort, conversations, messages } = await build()
        conversations.nodeRows.mockResolvedValue([{ id: "c1", leadId: null, channel: "web", handledBy: null }])
        messages.nodeRows.mockResolvedValue(stored)

        await expect(
            messagePort.read(TURN, { where: { authorKind: "user" }, fields: ["id", "body"] }, "turn"),
        ).resolves.toEqual([{ id: "m1", body: "a" }])
        expect(messages.nodeRows).toHaveBeenCalledWith("ws-1", "c1", 50)
    })

    it("needs a named conversation of the workspace on a workspace read, and reaches nothing in another workspace", async () => {
        const { messagePort, conversations, messages } = await build()
        conversations.nodeRows.mockResolvedValueOnce([])
        messages.nodeRows.mockResolvedValue(stored)

        await expect(messagePort.read(TURN, { fields: ["id"] }, "workspace")).resolves.toEqual([])
        await expect(
            messagePort.read(TURN, { where: { conversationId: "c-other" }, fields: ["id"] }, "workspace"),
        ).resolves.toEqual([])
        await expect(messagePort.read({ ...TURN, conversationId: null }, { fields: ["id"] }, "turn")).resolves.toEqual(
            [],
        )
        expect(messages.nodeRows).not.toHaveBeenCalled()
    })
})

describe("KnowledgeNodePortService", () => {
    const documents = [
        {
            id: "d1",
            title: "Giá",
            topic: null,
            kind: "text",
            visibility: "public" as const,
            updatedAt: "",
            content: "120k",
        },
        {
            id: "d2",
            title: "Vốn",
            topic: null,
            kind: "text",
            visibility: "internal" as const,
            updatedAt: "",
            content: "60k",
        },
    ]

    it("gives a turn read the customer view: public documents of the module and installation of the agent", async () => {
        const { knowledgePort, agents, conversations, sources } = await build()
        agents.turnFactsOf.mockResolvedValue({ module: "chatbot" } as never)
        conversations.installationIdOf.mockResolvedValue("inst-1")
        sources.readableFor.mockResolvedValue(documents.slice(0, 1))

        await expect(
            knowledgePort.read(TURN, { where: { visibility: "public" }, fields: ["id", "body"] }, "turn"),
        ).resolves.toEqual([{ id: "d1", body: "120k" }])
        expect(sources.readableFor).toHaveBeenCalledWith(
            { workspaceId: "ws-1", module: "chatbot", installationId: "inst-1", audience: "customer" },
            50,
        )
    })

    it("opens the internal documents only to a workspace read, and asks for no installation without a conversation", async () => {
        const { knowledgePort, agents, sources } = await build()
        agents.turnFactsOf.mockResolvedValue({ module: "chatbot" } as never)
        sources.readableFor.mockResolvedValue(documents)

        await expect(
            knowledgePort.read(
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
        const { knowledgePort, agents, sources } = await build()
        agents.turnFactsOf.mockResolvedValue(null)

        await expect(knowledgePort.read(TURN, { fields: ["id"] }, "turn")).resolves.toEqual([])
        expect(sources.readableFor).not.toHaveBeenCalled()
    })
})
