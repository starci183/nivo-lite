import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelSendExecutorService } from "./channel-send-executor.service"
import { ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

const NOW = new Date("2026-11-04T10:00:00.000Z")

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "c1",
    locale: "vi",
}

const conversation = (overrides: Partial<TurnConversation> = {}): TurnConversation =>
    ({
        id: "c1",
        workspaceId: "ws-1",
        channel: "telegram",
        externalId: "555",
        connectionId: "k1",
        leadId: null,
        handledBy: null,
        visitorName: null,
        installationId: null,
        agent: { id: "a-1" },
        speaksAs: null,
        ...overrides,
    }) as TurnConversation

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const conversations = mock<AgentConversationsService>()
    const messages = mock<AgentMessagesService>()
    const delivery = mock<ChannelDeliveryService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelSendExecutorService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: delivery },
        ],
    }).compile()
    conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation() })
    messages.storeAgentMessage.mockResolvedValue("m1")
    delivery.deliver.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged" })
    return { executor: moduleRef.get(ChannelSendExecutorService), registry, conversations, messages, delivery, logger }
}

const SEND = { conversationId: "c1", text: "Xin chào" }

describe("ChannelSendExecutorService", () => {
    it("registers itself with the graph-nodes registry", async () => {
        const { executor, registry } = await build()
        executor.onModuleInit()
        expect(registry.addExecutor).toHaveBeenCalledWith(executor)
        expect(executor.effect).toBe("channel.send")
    })

    it("stores the text, pushes it through the outbound path and answers the stored message", async () => {
        const { executor, messages, delivery } = await build()

        await expect(
            executor.execute(TURN, { ...SEND, attachments: [{ url: "https://x/menu", name: "Menu" }] }),
        ).resolves.toEqual({ kind: "message", id: "m1" })
        expect(messages.storeAgentMessage).toHaveBeenCalledWith("ws-1", "c1", "Xin chào\nMenu: https://x/menu")
        expect(delivery.deliver).toHaveBeenCalledWith({
            conversationId: "c1",
            messageId: "m1",
            text: "Xin chào\nMenu: https://x/menu",
        })
    })

    it("refuses a payload that is not a conversation and a text", async () => {
        const { executor } = await build()
        await expect(executor.execute(TURN, { conversationId: "c1" })).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.InvalidPayload,
        })
    })

    it("refuses another conversation than the turn serves, and one that is not in the workspace", async () => {
        const { executor, conversations, messages } = await build()
        await expect(executor.execute(TURN, { ...SEND, conversationId: "c2" })).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.WrongConversation,
        })
        conversations.turnOf.mockResolvedValueOnce({ kind: "refused", code: "x" } as never)
        await expect(executor.execute(TURN, SEND)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.ConversationNotFound,
        })
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: conversation({ workspaceId: "ws-2" }) })
        await expect(executor.execute(TURN, SEND)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.ConversationNotFound,
        })
        expect(messages.storeAgentMessage).not.toHaveBeenCalled()
    })

    it("stays silent once a person took the conversation over, or another agent speaks in it", async () => {
        const { executor, conversations, messages } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: conversation({ handledBy: "Lan" }) })
        await expect(executor.execute(TURN, SEND)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.HeldByPerson,
        })
        conversations.turnOf.mockResolvedValueOnce({
            kind: "ok",
            value: conversation({ agent: { id: "a-2" } as TurnConversation["agent"] }),
        })
        await expect(executor.execute(TURN, SEND)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.NotSpeaking,
        })
        expect(messages.storeAgentMessage).not.toHaveBeenCalled()
    })

    it("refuses on Zalo after the free window, before anything is stored, and sends inside it or when the customer never wrote", async () => {
        const { executor, conversations, messages, delivery } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ channel: "zalo" }) })

        messages.lastCustomerAt.mockResolvedValueOnce({
            kind: "ok",
            value: new Date(NOW.getTime() - ZALO_FREE_WINDOW_MS - 1),
        })
        await expect(executor.execute(TURN, SEND)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.ZaloWindowExpired,
        })
        expect(messages.storeAgentMessage).not.toHaveBeenCalled()

        messages.lastCustomerAt.mockResolvedValueOnce({
            kind: "ok",
            value: new Date(NOW.getTime() - ZALO_FREE_WINDOW_MS + 1000),
        })
        await expect(executor.execute(TURN, SEND)).resolves.toEqual({ kind: "message", id: "m1" })
        messages.lastCustomerAt.mockResolvedValueOnce({ kind: "refused", code: "x" } as never)
        await expect(executor.execute(TURN, SEND)).resolves.toEqual({ kind: "message", id: "m1" })
        expect(delivery.deliver).toHaveBeenCalledTimes(2)
    })

    it("throws when the channel refused or did not confirm", async () => {
        const { executor, delivery } = await build()
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: null, outcome: "rejected" })
        await expect(executor.execute(TURN, SEND)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryRejected,
        })
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: null, outcome: "ambiguous" })
        await expect(executor.execute(TURN, SEND)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryUnconfirmed,
        })
    })

    it("speaks in any conversation of the workspace when the turn serves none", async () => {
        const { executor } = await build()
        await expect(executor.execute({ ...TURN, conversationId: null }, SEND)).resolves.toEqual({
            kind: "message",
            id: "m1",
        })
    })

    it("keeps the message in the conversation, marked not sent, when the customer has no recipient yet, and raises no error", async () => {
        const { executor, conversations, messages, delivery, logger } = await build()
        conversations.turnOf.mockResolvedValueOnce({
            kind: "ok",
            value: conversation({ channel: "zalo", externalId: null }),
        })
        conversations.turnOf.mockResolvedValueOnce({
            kind: "ok",
            value: conversation({ channel: "telegram", connectionId: null }),
        })

        await expect(executor.execute(TURN, SEND)).resolves.toEqual({ kind: "message", id: "m1" })
        await expect(executor.execute(TURN, SEND)).resolves.toEqual({ kind: "message", id: "m1" })

        expect(messages.storeAgentMessage).toHaveBeenCalledTimes(2)
        expect(messages.markDelivery).toHaveBeenCalledWith("m1", false, "recipient_not_linked")
        expect(messages.lastCustomerAt).not.toHaveBeenCalled()
        expect(delivery.deliver).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenNthCalledWith(1, "chat_node_ports.undelivered", {
            conversationId: "c1",
            channel: "zalo",
            reason: "recipient_not_linked",
        })
        expect(logger.info).toHaveBeenCalledTimes(2)
    })
})
