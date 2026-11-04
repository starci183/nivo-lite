import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationRef } from "@modules/domain/agent-conversations"
import { AgentChannelRefsService, AgentMessagesService, messageStampOf } from "@modules/domain/agent-messages"
import { InboundFilesService } from "@modules/domain/chat-files"
import type { DownloadedChatFile } from "@modules/domain/chat-files"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ChatTurnQueue } from "@modules/queues/chat-turn"
import type { Hearing } from "./customer-hearing.contracts"
import { CustomerHearingService } from "./customer-hearing.service"
import { CustomerIntakeService } from "./customer-intake.service"

const NOW = Date.parse("2026-10-12T10:00:00.000Z")
const SENT_AT = NOW - 60_000

const receipt: DownloadedChatFile = {
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    name: "a.png",
    sourceUrl: "https://cdn.test/a.png",
}

const hearingOf = builder<Hearing>({
    workspaceId: "ws-1",
    connectionId: "c-1",
    channel: "zalo",
    customerId: "user-1",
    visitor: "Minh",
    agent: { id: "agent-1", greeting: "Welcome!" },
    text: "Hello",
    channelEventId: "zalo:m-1",
})

const known = (patch: Partial<ConversationRef> = {}): ConversationRef => ({
    id: "conv-1",
    agentId: "agent-1",
    leadId: null,
    handledBy: null,
    visitorName: "Minh",
    ...patch,
})

const queuedTurn = builder<Parameters<CustomerIntakeService["answer"]>[0]>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    channelEventId: "zalo:m-1",
    lookupName: false,
})

interface Setup {
    readonly existing?: ConversationRef
    readonly storedAs?: string
}

const build = async (setup: Setup = {}) => {
    const conversations = mock<AgentConversationsService>()
    conversations.find.mockResolvedValue(
        setup.existing === undefined
            ? { kind: "refused", code: AgentConversationsErrorCode.NotFound }
            : { kind: "ok", value: setup.existing },
    )
    conversations.open.mockResolvedValue(known())
    conversations.rebind.mockResolvedValue(undefined)
    const messages = mock<AgentMessagesService>()
    messages.storeCustomer.mockResolvedValue("msg-1")
    messages.storeGreeting.mockResolvedValue("greet-1")
    const channelRefs = mock<AgentChannelRefsService>()
    channelRefs.messageOf.mockResolvedValue(setup.storedAs ?? null)
    channelRefs.mark.mockResolvedValue(undefined)
    const inboundFiles = mock<InboundFilesService>()
    inboundFiles.keep.mockResolvedValue(true)
    const intake = mock<CustomerIntakeService>()
    intake.answer.mockResolvedValue(undefined)
    const queue = mock<ChatTurnQueue>()
    queue.enqueueChatTurn.mockResolvedValue(undefined)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => `<${key}>`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerHearingService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ChatTurnQueue, useValue: queue },
            { provide: CustomerIntakeService, useValue: intake },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: AgentChannelRefsService, useValue: channelRefs },
            { provide: InboundFilesService, useValue: inboundFiles },
        ],
    }).compile()
    const service = moduleRef.get(CustomerHearingService)
    return { service, conversations, messages, channelRefs, inboundFiles, intake, queue }
}

describe("CustomerHearingService > hear", () => {
    it("opens the conversation of a new customer, stores the message marked with its channel id, keeps its files and answers it", async () => {
        const manager = mockEntityManager()
        const { service, conversations, messages, channelRefs, inboundFiles, intake } = await build()

        await service.hear(hearingOf({ files: [receipt] }), manager)

        expect(conversations.open).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                channel: "zalo",
                customerId: "user-1",
                visitor: "Minh",
                connectionId: "c-1",
            },
            manager,
        )
        expect(channelRefs.messageOf).toHaveBeenCalledWith("conv-1", "zalo:m-1", manager)
        expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", manager)
        expect(channelRefs.mark).toHaveBeenCalledWith("msg-1", "zalo:m-1", manager)
        expect(inboundFiles.keep).toHaveBeenCalledWith(
            { workspaceId: "ws-1", conversationId: "conv-1" },
            receipt,
            "zalo:m-1",
            "msg-1",
            manager,
        )
        expect(intake.answer).toHaveBeenCalledWith(queuedTurn({ lookupName: true }), manager)
    })

    it("stores a message heard again once: the replay neither stores it nor its files, and answers the message stored first", async () => {
        const manager = mockEntityManager()
        const { service, messages, channelRefs, inboundFiles, intake } = await build({
            existing: known(),
            storedAs: "msg-first",
        })

        await service.hear(hearingOf({ files: [receipt] }), manager)

        expect(messages.storeCustomer).not.toHaveBeenCalled()
        expect(channelRefs.mark).not.toHaveBeenCalled()
        expect(inboundFiles.keep).not.toHaveBeenCalled()
        expect(intake.answer).toHaveBeenCalledWith(queuedTurn({ messageId: "msg-first" }), manager)
    })
})

describe("CustomerHearingService > hear, a known conversation and the time of a message", () => {
    it("continues a known conversation, moves it to the current front-door agent, and asks no name lookup off Zalo", async () => {
        const manager = mockEntityManager()
        const { service, conversations, intake } = await build({ existing: known({ agentId: "agent-old" }) })

        await service.hear(hearingOf({ channel: "telegram", channelEventId: "tg:555:9" }), manager)

        expect(conversations.open).not.toHaveBeenCalled()
        expect(conversations.rebind).toHaveBeenCalledWith("conv-1", "agent-1", manager)
        expect(intake.answer).toHaveBeenCalledWith(queuedTurn({ channelEventId: "tg:555:9" }), manager)
    })

    it("keeps the agent of a conversation it already has without rebinding it", async () => {
        const manager = mockEntityManager()
        const { service, conversations, intake } = await build({ existing: known() })

        await service.hear(hearingOf(), manager)

        expect(conversations.rebind).not.toHaveBeenCalled()
        expect(intake.answer).toHaveBeenCalledTimes(1)
    })

    it("stores the message and starts nothing while a person holds the conversation", async () => {
        const manager = mockEntityManager()
        const { service, messages, intake } = await build({ existing: known({ handledBy: "Lan" }) })

        await service.hear(hearingOf(), manager)

        expect(messages.storeCustomer).toHaveBeenCalledTimes(1)
        expect(intake.answer).not.toHaveBeenCalled()
    })

    it("stores a message at the time the channel says it was sent, with the tie-break of its id", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build()

        await service.hear(hearingOf({ sentAt: SENT_AT }), manager)

        expect(messages.storeCustomer).toHaveBeenCalledWith(
            "ws-1",
            "conv-1",
            "Hello",
            manager,
            null,
            messageStampOf(SENT_AT, NOW, "zalo:m-1"),
        )
    })

    it("never stores a message in the future, and stores one with no time at the time it arrived", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build()

        await service.hear(hearingOf({ sentAt: NOW + 86_400_000 }), manager)
        await service.hear(hearingOf({ sentAt: null }), manager)

        expect(messages.storeCustomer.mock.calls[0]?.[5]?.at).toEqual(new Date(NOW))
        expect(messages.storeCustomer).toHaveBeenNthCalledWith(2, "ws-1", "conv-1", "Hello", manager)
    })
})

describe("CustomerHearingService > greet", () => {
    it("greets a new visit with the agent's line and asks for its delivery, with no AI call", async () => {
        const manager = mockEntityManager()
        const { service, messages, queue, intake } = await build()

        await service.greet(hearingOf(), "tg:555:9", manager)

        expect(messages.storeGreeting).toHaveBeenCalledWith("ws-1", "conv-1", "Welcome!", manager)
        expect(queue.enqueueChatTurn).toHaveBeenCalledWith(
            {
                kind: "deliver",
                workspaceId: "ws-1",
                conversationId: "conv-1",
                messageId: "greet-1",
                channelEventId: "tg:555:9",
                lookupName: false,
            },
            manager,
        )
        expect(intake.answer).not.toHaveBeenCalled()
    })

    it("greets with the default line when the agent's greeting is blank", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build()

        await service.greet(hearingOf({ agent: { id: "agent-1", greeting: "  " } }), "tg:555:9", manager)

        expect(messages.storeGreeting).toHaveBeenCalledWith(
            "ws-1",
            "conv-1",
            "<conversations.fallbackGreeting>",
            manager,
        )
    })
})
