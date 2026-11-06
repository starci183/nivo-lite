import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ChatConversationsService, ChatMessagesService, chatStampOf } from "@modules/domain/chat-records"
import type { ChatConversationRef, Met } from "@modules/domain/chat-records"
import { CLOCK } from "@modules/platform/clock"
import type { Hearing } from "./customer-hearing.contracts"
import { CustomerHearingService } from "./customer-hearing.service"
import { CustomerIntakeService } from "./customer-intake.service"

const NOW = Date.parse("2026-10-12T10:00:00.000Z")
const SENT_AT = NOW - 60_000

const hearingOf = builder<Hearing>({
    workspaceId: "ws-1",
    connectionId: "c-1",
    channel: "zalo",
    customerId: "user-1",
    visitor: "Minh",
    agent: { id: "agent-1" },
    text: "Hello",
    channelEventId: "zalo:m-1",
})

const refOf = (patch: Partial<ChatConversationRef> = {}): ChatConversationRef => ({
    id: "conv-1",
    agentId: "agent-1",
    leadId: null,
    handledBy: null,
    visitorName: "Minh",
    ...patch,
})

const metOf = (created: boolean, patch: Partial<ChatConversationRef> = {}): Met => ({
    conversation: refOf(patch),
    created,
})

const queuedTurn = builder<Parameters<CustomerIntakeService["answer"]>[0]>({
    workspaceId: "ws-1",
    agentId: "agent-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    channelEventId: "zalo:m-1",
    lookupName: false,
})

const build = async (met: Met = metOf(false)) => {
    const conversations = mock<ChatConversationsService>()
    conversations.meet.mockResolvedValue(met)
    const messages = mock<ChatMessagesService>()
    messages.storeCustomer.mockResolvedValue({ id: "msg-1", stored: true })
    const intake = mock<CustomerIntakeService>()
    intake.answer.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerHearingService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: CustomerIntakeService, useValue: intake },
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
        ],
    }).compile()
    return { service: moduleRef.get(CustomerHearingService), conversations, messages, intake }
}

describe("CustomerHearingService > hear", () => {
    it("meets the customer, stores the message under its channel id and answers it, asking a new Zalo customer's name", async () => {
        const manager = mockEntityManager()
        const { service, conversations, messages, intake } = await build(metOf(true))

        await service.hear(hearingOf(), manager)

        expect(conversations.meet).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            channel: "zalo",
            customerId: "user-1",
            visitor: "Minh",
            connectionId: "c-1",
        })
        expect(messages.storeCustomer).toHaveBeenCalledWith("ws-1", "conv-1", "Hello", "zalo:m-1", null)
        expect(intake.answer).toHaveBeenCalledWith(queuedTurn({ lookupName: true }), manager)
    })

    it("answers the message stored first when it is heard again, which the wake key keeps to one answer", async () => {
        const manager = mockEntityManager()
        const { service, messages, intake } = await build()
        messages.storeCustomer.mockResolvedValue({ id: "msg-first", stored: false })

        await service.hear(hearingOf(), manager)

        expect(intake.answer).toHaveBeenCalledWith(queuedTurn({ messageId: "msg-first" }), manager)
    })

    it("asks no name lookup off Zalo, and none for a customer already met", async () => {
        const manager = mockEntityManager()
        const { service, intake } = await build(metOf(true))

        await service.hear(hearingOf({ channel: "telegram", channelEventId: "tg:c-1:555:9" }), manager)

        expect(intake.answer).toHaveBeenCalledWith(queuedTurn({ channelEventId: "tg:c-1:555:9" }), manager)
    })

    it("answers with the agent that speaks in the conversation after it followed the front door", async () => {
        const manager = mockEntityManager()
        const { service, intake } = await build(metOf(false, { agentId: "agent-front" }))

        await service.hear(hearingOf(), manager)

        expect(intake.answer).toHaveBeenCalledWith(queuedTurn({ agentId: "agent-front" }), manager)
    })

    it("stores the message and starts nothing while a person holds the conversation", async () => {
        const manager = mockEntityManager()
        const { service, messages, intake } = await build(metOf(false, { handledBy: "Lan" }))

        await service.hear(hearingOf(), manager)

        expect(messages.storeCustomer).toHaveBeenCalledTimes(1)
        expect(intake.answer).not.toHaveBeenCalled()
    })
})

describe("CustomerHearingService > hear, the time of a message", () => {
    it("stores a message at the time the channel says it was sent, with the tie-break of its id", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build()

        await service.hear(hearingOf({ sentAt: SENT_AT }), manager)

        expect(messages.storeCustomer).toHaveBeenCalledWith(
            "ws-1",
            "conv-1",
            "Hello",
            "zalo:m-1",
            chatStampOf(SENT_AT, NOW, "zalo:m-1"),
        )
    })

    it("never stores a message in the future, and stores one with no time at the time it arrived", async () => {
        const manager = mockEntityManager()
        const { service, messages } = await build()

        await service.hear(hearingOf({ sentAt: NOW + 86_400_000 }), manager)
        await service.hear(hearingOf({ sentAt: null }), manager)

        expect(messages.storeCustomer.mock.calls[0]?.[4]?.at).toEqual(new Date(NOW))
        expect(messages.storeCustomer).toHaveBeenNthCalledWith(2, "ws-1", "conv-1", "Hello", "zalo:m-1", null)
    })
})
