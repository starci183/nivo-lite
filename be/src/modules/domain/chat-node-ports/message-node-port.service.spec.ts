import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            MessageNodePortService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
        ],
    }).compile()
    return { port: moduleRef.get(MessageNodePortService), registry, conversations, messages }
}

describe("MessageNodePortService", () => {
    const stored = [
        { id: "m2", conversationId: "c1", authorKind: "agent", body: "b", createdAt: "2026-01-02T00:00:00.000Z" },
        { id: "m1", conversationId: "c1", authorKind: "user", body: "a", createdAt: "2026-01-01T00:00:00.000Z" },
    ]

    it("reads the messages of the conversation of the turn, cut to the fields", async () => {
        const { port, conversations, messages } = await build()
        conversations.nodeRows.mockResolvedValue([{ id: "c1", leadId: null, channel: "web", handledBy: null }])
        messages.nodeRows.mockResolvedValue(stored)

        await expect(
            port.read(TURN, { where: { authorKind: "user" }, fields: ["id", "body"] }, "turn"),
        ).resolves.toEqual([{ id: "m1", body: "a" }])
        expect(messages.nodeRows).toHaveBeenCalledWith("ws-1", "c1", 50)
    })

    it("needs a named conversation of the workspace on a workspace read, and reaches nothing in another workspace", async () => {
        const { port, conversations, messages } = await build()
        conversations.nodeRows.mockResolvedValueOnce([])
        messages.nodeRows.mockResolvedValue(stored)

        await expect(port.read(TURN, { fields: ["id"] }, "workspace")).resolves.toEqual([])
        await expect(
            port.read(TURN, { where: { conversationId: "c-other" }, fields: ["id"] }, "workspace"),
        ).resolves.toEqual([])
        await expect(port.read({ ...TURN, conversationId: null }, { fields: ["id"] }, "turn")).resolves.toEqual([])
        expect(messages.nodeRows).not.toHaveBeenCalled()
    })

    it("registers itself with the graph-nodes registry", async () => {
        const { port, registry } = await build()
        port.onModuleInit()
        expect(registry.addDataPort.mock.calls.map(([registered]) => registered.kind)).toEqual(["message"])
    })
})
