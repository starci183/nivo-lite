import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationRef } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelsErrorCode, ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import { ConversationsService } from "./conversations.service"
import { FIND_FRONT_AGENT } from "./persistence/conversations.sql"

const NOW = Date.parse("2026-10-12T10:00:00.000Z")
const CONNECTION = "c-1"

const known = (patch: Partial<ConversationRef> = {}): ConversationRef => ({
    id: "conv-1",
    agentId: "agent-1",
    leadId: null,
    handledBy: null,
    visitorName: "Minh",
    ...patch,
})

interface Setup {
    readonly agent?: ReadonlyArray<unknown>
    readonly connection?: boolean
    readonly existing?: ConversationRef
}

const build = async (setup: Setup = {}) => {
    const manager = mockEntityManager({
        query: [FIND_FRONT_AGENT, setup.agent ?? [{ id: "agent-1", greeting: "Welcome!" }]],
    })
    const queue = mock<ChatTurnQueue>()
    queue.enqueueChatTurn.mockResolvedValue(undefined)
    const connections = mock<ConnectionsService>()
    connections.intakeOf.mockResolvedValue(
        setup.connection === false
            ? { kind: "refused", code: ConnectionsErrorCode.NotFound }
            : { kind: "ok", value: { id: CONNECTION, workspaceId: "ws-1", status: "connected" } },
    )
    connections.markReceived.mockResolvedValue(undefined)
    const conversations = mock<AgentConversationsService>()
    conversations.find.mockResolvedValue(
        setup.existing === undefined
            ? { kind: "refused", code: AgentConversationsErrorCode.NotFound }
            : { kind: "ok", value: setup.existing },
    )
    conversations.open.mockResolvedValue(known())
    conversations.archive.mockResolvedValue(undefined)
    conversations.rebind.mockResolvedValue(undefined)
    const messages = mock<AgentMessagesService>()
    messages.storeCustomer.mockResolvedValue("msg-1")
    messages.storeGreeting.mockResolvedValue("greet-1")
    const inboundEvents = mock<InboundEventsService>()
    inboundEvents.keepUnrouted.mockResolvedValue(undefined)
    const zalo = mock<ZaloCredentialsService>()
    const catalog: MessageCatalog = { get: (key) => `<${key}>` }
    const moduleRef = await Test.createTestingModule({
        providers: [
            ConversationsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ChatTurnQueue, useValue: queue },
            { provide: ConnectionsService, useValue: connections },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: InboundEventsService, useValue: inboundEvents },
            { provide: ZaloCredentialsService, useValue: zalo },
        ],
    }).compile()
    return { service: moduleRef.get(ConversationsService), manager, queue, connections, conversations, messages, inboundEvents, zalo }
}

const telegram = (patch: Record<string, unknown> = {}) => ({
    updateId: 77,
    chatId: "555",
    messageId: 9,
    text: "Hello",
    visitor: "Minh Tran",
    isStart: false,
    ...patch,
})

const zaloMessage = (patch: Record<string, unknown> = {}) => ({ appId: "", userId: "user-1", messageId: "m-1", text: "Hello", ...patch })

describe("ConversationsService", () => {
    describe("acceptTelegram", () => {
        it("opens the conversation of a new customer, stores the message and enqueues the turn", async () => {
            const { service, manager, queue, conversations, messages } = await build()

            await service.acceptTelegram(CONNECTION, telegram(), manager)

            expect(conversations.open).toHaveBeenCalledWith(
                { workspaceId: "ws-1", agentId: "agent-1", channel: "telegram", customerId: "555", visitor: "Minh Tran", connectionId: CONNECTION },
                manager,
            )
            expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", manager)
            expect(queue.enqueueChatTurn).toHaveBeenCalledWith(
                { kind: "turn", workspaceId: "ws-1", conversationId: "conv-1", messageId: "msg-1", channelEventId: "tg:555:9", lookupName: false },
                manager,
            )
        })

        it("continues the conversation of a known customer without opening or rebinding it", async () => {
            const { service, manager, queue, conversations } = await build({ existing: known() })

            await service.acceptTelegram(CONNECTION, telegram(), manager)

            expect(conversations.open).not.toHaveBeenCalled()
            expect(conversations.rebind).not.toHaveBeenCalled()
            expect(queue.enqueueChatTurn).toHaveBeenCalledTimes(1)
        })

        it("moves a conversation to the connection current front-door agent", async () => {
            const { service, manager, conversations } = await build({ existing: known({ agentId: "agent-old" }) })

            await service.acceptTelegram(CONNECTION, telegram(), manager)

            expect(conversations.rebind).toHaveBeenCalledWith("conv-1", "agent-1", manager)
        })

        it("stores the message and enqueues nothing while a person holds the conversation", async () => {
            const { service, manager, queue, messages } = await build({ existing: known({ handledBy: "Lan" }) })

            await service.acceptTelegram(CONNECTION, telegram(), manager)

            expect(messages.storeCustomer).toHaveBeenCalledTimes(1)
            expect(queue.enqueueChatTurn).not.toHaveBeenCalled()
        })

        it("only keeps the message in the inbox when no agent is bound to the connection", async () => {
            const { service, manager, queue, inboundEvents, conversations } = await build({ agent: [] })

            await service.acceptTelegram(CONNECTION, telegram(), manager)

            expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(
                manager,
                { workspaceId: "ws-1", channel: "telegram", sender: "Minh Tran", body: "Hello", eventId: "tg:c-1:555:9" },
            )
            expect(conversations.open).not.toHaveBeenCalled()
            expect(queue.enqueueChatTurn).not.toHaveBeenCalled()
        })

        it("ignores a delivery for a connection that is gone", async () => {
            const { service, manager, queue } = await build({ connection: false })

            await service.acceptTelegram(CONNECTION, telegram(), manager)

            expect(manager.query).not.toHaveBeenCalled()
            expect(queue.enqueueChatTurn).not.toHaveBeenCalled()
        })

        it("opens a new visit on /start: archives the old conversation and delivers the greeting of the agent without an AI call", async () => {
            const { service, manager, queue, conversations, messages } = await build()

            await service.acceptTelegram(CONNECTION, telegram({ text: "/start", isStart: true }), manager)

            expect(conversations.archive).toHaveBeenCalledWith("ws-1", "telegram", CONNECTION, "555", `555:${NOW}`, manager)
            expect(messages.storeGreeting).toHaveBeenCalledWith("ws-1", "conv-1", "Welcome!", manager)
            expect(messages.storeCustomer).not.toHaveBeenCalled()
            expect(queue.enqueueChatTurn).toHaveBeenCalledWith(
                { kind: "deliver", workspaceId: "ws-1", conversationId: "conv-1", messageId: "greet-1", channelEventId: "tg:555:9", lookupName: false },
                manager,
            )
        })

        it("greets with the default line when the agent has no greeting of its own", async () => {
            const { service, manager, messages } = await build({ agent: [{ id: "agent-1", greeting: "  " }] })

            await service.acceptTelegram(CONNECTION, telegram({ text: "/start", isStart: true }), manager)

            expect(messages.storeGreeting).toHaveBeenCalledWith("ws-1", "conv-1", "<conversations.fallbackGreeting>", manager)
        })
    })

    describe("acceptZalo", () => {
        it("marks the connection received, opens the conversation and asks the job to look the customer name up", async () => {
            const { service, manager, queue, connections, conversations, zalo } = await build()
            zalo.load.mockResolvedValue({ kind: "ok", value: { secret: { appId: "app-1", appSecret: "s", oaSecret: "o" }, expiresAt: null, workspaceId: "ws-1" } })

            await service.acceptZalo(CONNECTION, zaloMessage({ appId: "app-1" }), manager)

            expect(connections.markReceived).toHaveBeenCalledWith(
                CONNECTION,
                { amount: 0, content: "<conversations.zaloGuest>", at: new Date(NOW).toISOString(), text: "Hello" },
                manager,
            )
            expect(conversations.open).toHaveBeenCalledWith(expect.objectContaining({ channel: "zalo", customerId: "user-1", visitor: "<conversations.zaloGuest>" }), manager)
            expect(queue.enqueueChatTurn).toHaveBeenCalledWith(
                { kind: "turn", workspaceId: "ws-1", conversationId: "conv-1", messageId: "msg-1", channelEventId: "zalo:m-1", lookupName: true },
                manager,
            )
        })

        it("keeps the name of a known customer, does not ask for it again and cuts the first event text at 160 characters", async () => {
            const { service, manager, queue, connections } = await build({ existing: known() })

            await service.acceptZalo(CONNECTION, zaloMessage({ text: "x".repeat(300) }), manager)

            expect(connections.markReceived).toHaveBeenCalledWith(
                CONNECTION,
                expect.objectContaining({ content: "Minh", text: "x".repeat(160) }),
                manager,
            )
            expect(queue.enqueueChatTurn).toHaveBeenCalledWith(expect.objectContaining({ lookupName: false }), manager)
        })

        it("falls back to the guest name for a known customer without one", async () => {
            const { service, manager, connections } = await build({ existing: known({ visitorName: null }) })

            await service.acceptZalo(CONNECTION, zaloMessage(), manager)

            expect(connections.markReceived).toHaveBeenCalledWith(CONNECTION, expect.objectContaining({ content: "<conversations.zaloGuest>" }), manager)
        })

        it("only keeps the message in the inbox when no agent is bound", async () => {
            const { service, manager, queue, inboundEvents } = await build({ agent: [] })

            await service.acceptZalo(CONNECTION, zaloMessage(), manager)

            expect(inboundEvents.keepUnrouted).toHaveBeenCalledWith(
                manager,
                { workspaceId: "ws-1", channel: "zalo", sender: "<conversations.zaloGuest>", body: "Hello", eventId: "zalo:c-1:m-1" },
            )
            expect(queue.enqueueChatTurn).not.toHaveBeenCalled()
        })

        it("ignores an event for another Zalo app and one for a connection that is gone", async () => {
            const other = await build()
            other.zalo.load.mockResolvedValue({ kind: "ok", value: { secret: { appId: "app-2", appSecret: "s", oaSecret: "o" }, expiresAt: null, workspaceId: "ws-1" } })
            const gone = await build({ connection: false })

            await other.service.acceptZalo(CONNECTION, zaloMessage({ appId: "app-1" }), other.manager)
            await gone.service.acceptZalo(CONNECTION, zaloMessage(), gone.manager)

            expect(other.connections.markReceived).not.toHaveBeenCalled()
            expect(gone.connections.markReceived).not.toHaveBeenCalled()
        })

        it("accepts an event whose app cannot be checked because the credential is unreadable", async () => {
            const { service, manager, connections, zalo } = await build()
            zalo.load.mockResolvedValue({ kind: "refused", code: ChannelsErrorCode.SecretUnreadable })

            await service.acceptZalo(CONNECTION, zaloMessage({ appId: "app-1" }), manager)

            expect(connections.markReceived).toHaveBeenCalledTimes(1)
        })
    })
})
