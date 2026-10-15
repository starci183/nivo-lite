import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentConversationsErrorCode, AgentConversationsService } from "@modules/domain/agent-conversations"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { EventsService } from "@modules/domain/events"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ok, refused } from "@modules/platform/primitives"
import { BookingNotifierService } from "./booking-notifier.service"

const NOTICE = { workspaceId: "ws-1", conversationId: "conversation-1", text: "Your appointment is confirmed" }
const targetOf = builder<ConversationTarget>({
    id: "conversation-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "customer-1",
    connectionId: "connection-1",
})

const build = async () => {
    const conversations = mock<AgentConversationsService>()
    conversations.targetOf.mockResolvedValue(ok(targetOf()))
    const messages = mock<AgentMessagesService>()
    messages.storeAgentMessage.mockResolvedValue("message-1")
    const channels = mock<ChannelDeliveryService>()
    channels.deliver.mockResolvedValue({ delivered: true, failure: null })
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => key)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingNotifierService,
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: channels },
            { provide: EventsService, useValue: events },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { service: moduleRef.get(BookingNotifierService), conversations, messages, channels, events, catalog }
}

describe("BookingNotifierService", () => {
    it.each(["telegram", "zalo", "facebook", "instagram", "website"])(
        "stores and delivers a notice through the existing %s conversation channel",
        async (channel) => {
            const { service, conversations, messages, channels, events, catalog } = await build()
            conversations.targetOf.mockResolvedValue(ok(targetOf({ channel })))

            await expect(service.notify(NOTICE)).resolves.toBe(true)

            expect(conversations.targetOf.mock.calls).toEqual([[NOTICE.conversationId]])
            expect(messages.storeAgentMessage.mock.calls).toEqual([
                [NOTICE.workspaceId, NOTICE.conversationId, NOTICE.text],
            ])
            expect(channels.deliver.mock.calls).toEqual(
                [{ conversationId: NOTICE.conversationId, messageId: "message-1", text: NOTICE.text }].map(
                    (request) => [request],
                ),
            )
            expect(events.record.mock.calls).toEqual([
                [
                    {
                        workspaceId: NOTICE.workspaceId,
                        kind: "booking.notified",
                        actor: "bookings.evidence.actor",
                        summary: "bookingPorts.delivered",
                        evidence: NOTICE.text,
                    },
                ],
            ])
            expect(catalog.get.mock.calls).toEqual([
                ["bookings.evidence.actor", {}, "vi"],
                ["bookingPorts.delivered", { channel }, "vi"],
            ])
        },
    )

    it("records a failed delivery honestly and returns false so the booking can retry", async () => {
        const { service, channels, events, catalog } = await build()
        channels.deliver.mockResolvedValue({ delivered: false, failure: "zalo_window_expired" })

        await expect(service.notify(NOTICE)).resolves.toBe(false)

        expect(events.record).toHaveBeenCalledWith({
            workspaceId: NOTICE.workspaceId,
            kind: "booking.notified",
            actor: "bookings.evidence.actor",
            summary: "bookingPorts.failed",
            evidence: NOTICE.text,
        })
        expect(catalog.get).toHaveBeenCalledWith("bookingPorts.failed", { channel: "telegram" }, "vi")
    })

    it("records an unavailable conversation without storing or sending a message", async () => {
        const { service, conversations, messages, channels, events, catalog } = await build()
        conversations.targetOf.mockResolvedValue(refused(AgentConversationsErrorCode.NotFound))

        await expect(service.notify(NOTICE)).resolves.toBe(false)

        expect(messages.storeAgentMessage).not.toHaveBeenCalled()
        expect(channels.deliver).not.toHaveBeenCalled()
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: NOTICE.workspaceId,
            kind: "booking.notified",
            actor: "bookings.evidence.actor",
            summary: "bookingPorts.failed",
            evidence: NOTICE.text,
        })
        expect(catalog.get).toHaveBeenCalledWith("bookingPorts.failed", { channel: "none" }, "vi")
    })

    it("refuses another workspace's conversation before writing anything", async () => {
        const { service, conversations, messages, channels, events, catalog } = await build()
        conversations.targetOf.mockResolvedValue(ok(targetOf({ workspaceId: "ws-2" })))

        await expect(service.notify(NOTICE)).resolves.toBe(false)

        expect(messages.storeAgentMessage).not.toHaveBeenCalled()
        expect(channels.deliver).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
        expect(catalog.get).not.toHaveBeenCalled()
    })

    it("propagates a conversation lookup failure without storing or delivering", async () => {
        const { service, conversations, messages, channels, events } = await build()
        const failure = new Error("Conversation lookup unavailable")
        conversations.targetOf.mockRejectedValue(failure)

        await expect(service.notify(NOTICE)).rejects.toBe(failure)

        expect(messages.storeAgentMessage).not.toHaveBeenCalled()
        expect(channels.deliver).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("propagates a storage failure without attempting delivery or claiming success", async () => {
        const { service, messages, channels, events } = await build()
        const failure = new Error("Message could not be stored")
        messages.storeAgentMessage.mockRejectedValue(failure)

        await expect(service.notify(NOTICE)).rejects.toBe(failure)

        expect(channels.deliver).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("propagates a retryable channel rejection without recording a delivery verdict", async () => {
        const { service, channels, events } = await build()
        const failure = new Error("Zalo refresh busy")
        channels.deliver.mockRejectedValue(failure)

        await expect(service.notify(NOTICE)).rejects.toBe(failure)

        expect(events.record).not.toHaveBeenCalled()
    })

    it("propagates an evidence write failure", async () => {
        const { service, channels, events } = await build()
        const failure = new Error("Evidence unavailable")
        events.record.mockRejectedValue(failure)

        await expect(service.notify(NOTICE)).rejects.toBe(failure)

        expect(channels.deliver).toHaveBeenCalledTimes(1)
        expect(events.record).toHaveBeenCalledTimes(1)
    })
})
