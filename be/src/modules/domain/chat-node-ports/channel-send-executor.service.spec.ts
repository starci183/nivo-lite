import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { ChannelDeliveryService, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatTurnConversation } from "@modules/domain/chat-records"
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

const AGENT: ChatTurnConversation["agent"] = {
    id: "a-1",
    name: "Chatbot",
    handle: "chatbot",
    role: "Customer chat",
    module: "chatbot",
    instructions: "Be kind",
    knowledge: "Tea",
    approvalRule: "ask",
    greeting: "Hi",
}

const conversation = (overrides: Partial<ChatTurnConversation> = {}): ChatTurnConversation => ({
    id: "c1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555",
    connectionId: "k1",
    leadId: null,
    handledBy: null,
    visitorName: null,
    installationId: null,
    agent: AGENT,
    speaksAs: null,
    ...overrides,
})

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const conversations = mock<ChatConversationsService>()
    const messages = mock<ChatMessagesService>()
    const delivery = mock<ChannelDeliveryService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelSendExecutorService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: delivery },
        ],
    }).compile()
    conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation() })
    messages.storeAgentLine.mockResolvedValue({ id: "m1", body: "Hello", sent: false })
    delivery.deliver.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged" })
    return { executor: moduleRef.get(ChannelSendExecutorService), registry, conversations, messages, delivery, logger }
}

const SEND = { conversationId: "c1", text: "Hello" }
const CALL = { key: "run:1", dedupeKey: null }

describe("ChannelSendExecutorService storing", () => {
    it("registers itself with the graph-nodes registry", async () => {
        const { executor, registry } = await build()
        executor.onModuleInit()
        expect(registry.addExecutor).toHaveBeenCalledWith(executor)
        expect(executor.effect).toBe("channel.send")
    })

    it("stores the text, pushes it through the outbound path and answers the stored message, logging that the channel took it", async () => {
        const { executor, messages, delivery, logger } = await build()

        await expect(
            executor.execute(TURN, { ...SEND, attachments: [{ url: "https://x/menu", name: "Menu" }] }, CALL),
        ).resolves.toEqual({ kind: "message", id: "m1" })
        expect(messages.storeAgentLine).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "c1",
            body: "Hello\nMenu: https://x/menu",
            key: "run:1",
        })
        expect(delivery.deliver).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "c1",
            messageId: "m1",
            text: "Hello\nMenu: https://x/menu",
        })
        expect(logger.info).toHaveBeenCalledWith("chat_node_ports.sent", { turnId: TURN.turnId, messageId: "m1" })
    })

    it("refuses a payload that is not a conversation and a text", async () => {
        const { executor } = await build()
        await expect(executor.execute(TURN, { conversationId: "c1" }, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.InvalidPayload,
        })
    })

    it("refuses another conversation than the turn serves, and one that is not in the workspace of the turn", async () => {
        const { executor, conversations, messages } = await build()
        await expect(executor.execute(TURN, { ...SEND, conversationId: "c2" }, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.WrongConversation,
        })
        conversations.turnOf.mockResolvedValueOnce({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.ConversationNotFound,
        })
        expect(conversations.turnOf).toHaveBeenCalledWith("ws-1", "c1")
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
    })

    it("stays silent once a person took the conversation over, or another agent speaks in it", async () => {
        const { executor, conversations, messages } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: conversation({ handledBy: "Lan" }) })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.HeldByPerson,
        })
        conversations.turnOf.mockResolvedValueOnce({
            kind: "ok",
            value: conversation({ agent: { ...AGENT, id: "a-2" } }),
        })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.NotSpeaking,
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
    })
})

describe("ChannelSendExecutorService Zalo window and delivery", () => {
    it("refuses on Zalo after the free window, before anything is stored, and sends inside it or when the customer never wrote", async () => {
        const { executor, conversations, messages, delivery } = await build()
        conversations.turnOf.mockResolvedValue({ kind: "ok", value: conversation({ channel: "zalo" }) })

        messages.lastCustomerAt.mockResolvedValueOnce({
            kind: "ok",
            value: new Date(NOW.getTime() - ZALO_FREE_WINDOW_MS - 1),
        })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.ZaloWindowExpired,
        })
        expect(messages.storeAgentLine).not.toHaveBeenCalled()

        messages.lastCustomerAt.mockResolvedValueOnce({
            kind: "ok",
            value: new Date(NOW.getTime() - ZALO_FREE_WINDOW_MS + 1000),
        })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toEqual({ kind: "message", id: "m1" })
        messages.lastCustomerAt.mockResolvedValueOnce({ kind: "refused", code: ChatRecordsErrorCode.NotFound })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toEqual({ kind: "message", id: "m1" })
        expect(delivery.deliver).toHaveBeenCalledTimes(2)
    })

    it("throws when the channel refused or did not confirm, logging the code and never the words", async () => {
        const { executor, delivery, logger } = await build()
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: null, outcome: "rejected" })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryRejected,
        })
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: null, outcome: "ambiguous" })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryUnconfirmed,
        })
        expect(logger.warn).toHaveBeenCalledWith("chat_node_ports.send_failed", {
            turnId: TURN.turnId,
            code: ChatNodePortsErrorCode.DeliveryRejected,
        })
        expect(logger.warn).toHaveBeenCalledWith("chat_node_ports.send_failed", {
            turnId: TURN.turnId,
            code: ChatNodePortsErrorCode.DeliveryUnconfirmed,
        })
        expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("Hello")
    })

    it("logs nothing about a failure that is not a refusal of the send (an unknown error passes through)", async () => {
        const { executor, delivery, logger } = await build()
        delivery.deliver.mockRejectedValueOnce(new Error("boom"))
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toThrow("boom")
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("speaks in any conversation of the workspace when the turn serves none", async () => {
        const { executor } = await build()
        await expect(executor.execute({ ...TURN, conversationId: null }, SEND, CALL)).resolves.toEqual({
            kind: "message",
            id: "m1",
        })
    })
})

describe("ChannelSendExecutorService unreachable recipients", () => {
    it("keeps the message in the conversation, marked not sent, and fails the step when the customer has no recipient yet", async () => {
        const { executor, conversations, messages, delivery, logger } = await build()
        conversations.turnOf.mockResolvedValueOnce({
            kind: "ok",
            value: conversation({ channel: "zalo", externalId: null }),
        })
        conversations.turnOf.mockResolvedValueOnce({
            kind: "ok",
            value: conversation({ channel: "telegram", connectionId: null }),
        })

        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.RecipientUnreachable,
        })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.RecipientUnreachable,
        })

        expect(messages.storeAgentLine).toHaveBeenCalledTimes(2)
        expect(messages.markDelivery).toHaveBeenCalledWith("ws-1", "m1", false, "recipient_not_linked")
        expect(messages.lastCustomerAt).not.toHaveBeenCalled()
        expect(delivery.deliver).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenNthCalledWith(1, "chat_node_ports.undelivered", {
            conversationId: "c1",
            channel: "zalo",
            reason: "recipient_not_linked",
        })
        expect(logger.info).toHaveBeenCalledTimes(2)
    })

    it("stores the line under the key of the effect call: a retry stores under the same key and only pushes again", async () => {
        const { executor, messages, delivery } = await build()
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: "zalo_quota", outcome: "rejected" })

        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryRejected,
        })
        await expect(executor.execute(TURN, SEND, CALL)).resolves.toEqual({ kind: "message", id: "m1" })
        await executor.execute(TURN, SEND, { key: "run:2", dedupeKey: "reply:t:abc" })

        expect(messages.storeAgentLine.mock.calls.map(([line]) => line.key)).toEqual(["run:1", "run:1", "reply:t:abc"])
        expect(delivery.deliver).toHaveBeenCalledTimes(3)
    })

    it("keeps the message as not sent and fails the step when the channel says the recipient cannot be reached", async () => {
        const { executor, messages, delivery, logger } = await build()
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: "zalo_recipient", outcome: "rejected" })
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: "zalo_unfollowed", outcome: "rejected" })

        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.RecipientUnreachable,
        })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.RecipientUnreachable,
        })

        expect(messages.markDelivery).toHaveBeenCalledWith("ws-1", "m1", false, "recipient_not_linked")
        expect(logger.info).toHaveBeenCalledTimes(2)
    })

    it("still throws for the refusals that are no fault of the recipient, and for an unconfirmed push", async () => {
        const { executor, delivery } = await build()
        for (const failure of ["zalo_window_expired", "zalo_quota", "zalo_token", "zalo_error", null] as const) {
            delivery.deliver.mockResolvedValueOnce({ delivered: false, failure, outcome: "rejected" })
            await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
                code: ChatNodePortsErrorCode.DeliveryRejected,
            })
        }
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: "zalo_recipient", outcome: "ambiguous" })
        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryUnconfirmed,
        })
    })
})

describe("ChannelSendExecutorService placeholders and plans", () => {
    it("treats a Zalo conversation of a placeholder sender as unlinked up front, fails the step and pushes nothing", async () => {
        const { executor, conversations, messages, delivery } = await build()
        conversations.turnOf.mockResolvedValue({
            kind: "ok",
            value: conversation({ channel: "zalo", externalId: "import-dinh:1730000000" }),
        })

        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.RecipientUnreachable,
        })

        expect(messages.markDelivery).toHaveBeenCalledWith("ws-1", "m1", false, "recipient_not_linked")
        expect(delivery.deliver).not.toHaveBeenCalled()
        expect(messages.lastCustomerAt).not.toHaveBeenCalled()
    })

    it("fails the step without retry when the plan of the channel does not allow the reply, leaving the verdict the channel stored", async () => {
        const { executor, messages, delivery, logger } = await build()
        delivery.deliver.mockResolvedValueOnce({ delivered: false, failure: "channel_plan", outcome: "rejected" })

        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.ChannelPlanBlocked,
        })

        expect(messages.markDelivery).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith("chat_node_ports.plan_blocked", {
            conversationId: "c1",
            channel: "telegram",
        })
    })
})
