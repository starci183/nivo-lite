import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { ConversationNodePortService } from "./conversation-node-port.service"

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
            ConversationNodePortService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
        ],
    }).compile()
    return { port: moduleRef.get(ConversationNodePortService), registry, conversations, messages }
}

describe("ConversationNodePortService", () => {
    it("reads the conversation of the turn with its status and last message, cut to the fields", async () => {
        const { port, conversations, messages } = await build()
        conversations.nodeRows.mockResolvedValue([
            { id: "c1", leadId: "l1", channel: "zalo", handledBy: "Lan" },
            { id: "c1", leadId: null, channel: "web", handledBy: null },
        ])
        messages.latestAt.mockResolvedValueOnce(new Date(1000)).mockResolvedValueOnce(null)

        const rows = await port.read(TURN, { fields: ["id", "status", "lastMessageAt"] }, "turn")

        expect(rows).toEqual([
            { id: "c1", status: "with_person", lastMessageAt: "1970-01-01T00:00:01.000Z" },
            { id: "c1", status: "agent", lastMessageAt: null },
        ])
        expect(conversations.nodeRows).toHaveBeenCalledWith("ws-1", expect.objectContaining({ id: "c1" }), 50)
    })

    it("reaches nothing on a turn read when the turn serves no conversation or another one is asked", async () => {
        const { port, conversations } = await build()

        await expect(port.read({ ...TURN, conversationId: null }, { fields: ["id"] }, "turn")).resolves.toEqual([])
        await expect(port.read(TURN, { where: { id: "c2" }, fields: ["id"] }, "turn")).resolves.toEqual([])
        expect(conversations.nodeRows).not.toHaveBeenCalled()
    })

    it("reaches the workspace on a workspace read, narrowed by where", async () => {
        const { port, conversations, messages } = await build()
        conversations.nodeRows.mockResolvedValue([
            { id: "c9", leadId: "l1", channel: "zalo", handledBy: null },
            { id: "c8", leadId: "l1", channel: "zalo", handledBy: "Lan" },
        ])
        messages.latestAt.mockResolvedValue(null)

        const rows = await port.read(
            { ...TURN, conversationId: null },
            { where: { leadId: "l1", channel: "zalo", status: "agent" }, fields: ["id"], limit: 5 },
            "workspace",
        )

        expect(rows).toEqual([{ id: "c9" }])
        expect(conversations.nodeRows).toHaveBeenCalledWith("ws-1", { id: undefined, leadId: "l1", channel: "zalo" }, 5)
    })

    it("registers itself with the graph-nodes registry", async () => {
        const { port, registry } = await build()
        port.onModuleInit()
        expect(registry.addDataPort.mock.calls.map(([registered]) => registered.kind)).toEqual(["conversation"])
    })
})
