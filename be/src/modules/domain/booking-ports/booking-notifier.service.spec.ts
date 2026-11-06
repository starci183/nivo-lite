import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { BookingNotice } from "@modules/domain/bookings"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { ChatConversationsService, ChatMessagesService, ChatRecordsErrorCode } from "@modules/domain/chat-records"
import type { ChatConversationTarget } from "@modules/domain/chat-records"
import { EventsService } from "@modules/domain/events"
import { WORKSPACE_MAILER } from "@modules/domain/work-performers"
import type { WorkspaceMailer } from "@modules/domain/work-performers"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import { BookingNotifierService } from "./booking-notifier.service"
import { BookingPortsLogEvent } from "./booking-ports.log-events"

const noticeOf = builder<BookingNotice>({
    workspaceId: "ws-1",
    bookingId: "booking-1",
    kind: "confirmed",
    leadId: "lead-1",
    conversationId: "conversation-1",
    email: " customer@example.com ",
    subject: "Booking confirmed",
    text: "Your appointment is confirmed",
    dedupeKey: "booking-1:confirmed",
})
const NOTICE = noticeOf()
const EVIDENCE = {
    workspaceId: "ws-1",
    kind: "booking.notified",
    actor: "bookings.evidence.actor",
    summary: "bookingPorts.delivered",
    evidence: "Your appointment is confirmed",
    leadId: "lead-1",
    workItemId: null,
}
const LINE = {
    workspaceId: "ws-1",
    conversationId: "conversation-1",
    body: "Your appointment is confirmed",
    key: "booking_notice:booking-1:confirmed",
}
const DELIVERY = {
    workspaceId: "ws-1",
    conversationId: "conversation-1",
    messageId: "message-1",
    text: "Your appointment is confirmed",
}
const EMAIL = {
    workspaceId: "ws-1",
    to: "customer@example.com",
    subject: "Booking confirmed",
    body: "Your appointment is confirmed",
    purpose: "booking",
    refs: { booking_id: "booking-1" },
    dedupeKey: "booking_notice:booking-1:confirmed",
    subjectType: "lead",
    subjectId: "lead-1",
    leadId: "lead-1",
}
const targetOf = builder<ChatConversationTarget>({
    id: "conversation-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "customer-1",
    connectionId: "connection-1",
})

const build = async () => {
    const conversations = mock<ChatConversationsService>()
    conversations.targetOf.mockResolvedValue(ok(targetOf()))
    const messages = mock<ChatMessagesService>()
    messages.storeAgentLine.mockResolvedValue({ id: "message-1", body: "Your appointment is confirmed", sent: false })
    const channels = mock<ChannelDeliveryService>()
    channels.deliver.mockResolvedValue({ delivered: true, outcome: "acknowledged", failure: null })
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => key)
    const logger = mock<Logger>()
    const mailer = mock<WorkspaceMailer>()
    mailer.requestCustomerEmail.mockResolvedValue({ status: "sent" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingNotifierService,
            { provide: ChatConversationsService, useValue: conversations },
            { provide: ChatMessagesService, useValue: messages },
            { provide: ChannelDeliveryService, useValue: channels },
            { provide: EventsService, useValue: events },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: WORKSPACE_MAILER, useValue: mailer },
        ],
    }).compile()
    return {
        service: moduleRef.get(BookingNotifierService),
        conversations,
        messages,
        channels,
        events,
        catalog,
        logger,
        mailer,
    }
}

describe("BookingNotifierService", () => {
    it.each(["telegram", "zalo", "facebook", "instagram", "website"])(
        "stores and delivers a notice through the workspace's %s conversation",
        async (channel) => {
            const { service, conversations, messages, channels, events, catalog, logger, mailer } = await build()
            conversations.targetOf.mockResolvedValue(ok(targetOf({ channel })))

            await expect(service.notify(NOTICE)).resolves.toEqual({ delivered: true, kept: true, via: channel })

            expect(conversations.targetOf.mock.calls).toEqual([["ws-1", "conversation-1"]])
            expect(messages.storeAgentLine.mock.calls).toEqual([[LINE]])
            expect(channels.deliver.mock.calls).toEqual([[DELIVERY]])
            expect(events.record.mock.calls).toEqual([[EVIDENCE]])
            expect(catalog.get.mock.calls).toEqual([
                ["bookings.evidence.actor", {}, "vi"],
                ["bookingPorts.delivered", { channel }, "vi"],
            ])
            expect(mailer.requestCustomerEmail).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        },
    )

    it("does not push a notice an earlier attempt already delivered", async () => {
        const { service, messages, channels } = await build()
        messages.storeAgentLine.mockResolvedValue({
            id: "message-1",
            body: "Your appointment is confirmed",
            sent: true,
        })

        await expect(service.notify(NOTICE)).resolves.toEqual({ delivered: true, kept: true, via: "telegram" })

        expect(channels.deliver).not.toHaveBeenCalled()
    })
})

describe("BookingNotifierService", () => {
    it.each([null, "work-item-1"])("records the notice's work item %s", async (workItemId) => {
        const { service, events } = await build()

        await expect(service.notify(noticeOf({ workItemId }))).resolves.toEqual({
            delivered: true,
            kept: true,
            via: "telegram",
        })

        expect(events.record.mock.calls).toEqual([[{ ...EVIDENCE, workItemId }]])
    })
})

describe("BookingNotifierService", () => {
    it("keeps a stored notice when the channel refuses delivery", async () => {
        const { service, messages, channels, events, catalog, mailer } = await build()
        channels.deliver.mockResolvedValue({ delivered: false, outcome: "rejected", failure: "zalo_window_expired" })

        await expect(service.notify(NOTICE)).resolves.toEqual({ delivered: false, kept: true, via: "telegram" })

        expect(messages.storeAgentLine.mock.calls).toEqual([[LINE]])
        expect(channels.deliver.mock.calls).toEqual([[DELIVERY]])
        expect(events.record.mock.calls).toEqual([[{ ...EVIDENCE, summary: "bookingPorts.failed" }]])
        expect(catalog.get.mock.calls).toEqual([
            ["bookings.evidence.actor", {}, "vi"],
            ["bookingPorts.failed", { channel: "telegram" }, "vi"],
        ])
        expect(mailer.requestCustomerEmail).not.toHaveBeenCalled()
    })
})

describe("BookingNotifierService", () => {
    it("logs a thrown channel push and keeps the stored notice without repeating or emailing it", async () => {
        const { service, messages, channels, events, logger, mailer } = await build()
        const failure = new Error("Zalo refresh busy")
        channels.deliver.mockRejectedValue(failure)

        await expect(service.notify(NOTICE)).resolves.toEqual({ delivered: false, kept: true, via: "telegram" })

        expect(messages.storeAgentLine.mock.calls).toEqual([[LINE]])
        expect(channels.deliver.mock.calls).toEqual([[DELIVERY]])
        expect(logger.error.mock.calls).toEqual([
            [BookingPortsLogEvent.DeliveryFailed, failure, { workspaceId: "ws-1", bookingId: "booking-1" }],
        ])
        expect(events.record.mock.calls).toEqual([[{ ...EVIDENCE, summary: "bookingPorts.failed" }]])
        expect(mailer.requestCustomerEmail).not.toHaveBeenCalled()
    })
})

describe("BookingNotifierService", () => {
    it.each([
        { reason: "names none", conversationId: null, leadId: "lead-1", lookups: [] },
        {
            reason: "is gone",
            conversationId: "conversation-1",
            leadId: "lead-1",
            lookups: [["ws-1", "conversation-1"]],
        },
        {
            reason: "is gone for a lead-less booking",
            conversationId: "conversation-1",
            leadId: null,
            lookups: [["ws-1", "conversation-1"]],
        },
    ])("falls back to email when the booking's conversation $reason", async ({ conversationId, leadId, lookups }) => {
        const { service, conversations, messages, channels, mailer, events } = await build()
        conversations.targetOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))

        await expect(service.notify(noticeOf({ conversationId, leadId }))).resolves.toEqual({
            delivered: true,
            kept: true,
            via: "email",
        })

        expect(conversations.targetOf.mock.calls).toEqual(lookups)
        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        expect(channels.deliver).not.toHaveBeenCalled()
        expect(mailer.requestCustomerEmail.mock.calls).toEqual([[{ ...EMAIL, subjectId: leadId, leadId }]])
        expect(events.record.mock.calls).toEqual([[{ ...EVIDENCE, leadId }]])
    })
})

describe("BookingNotifierService", () => {
    it.each([
        { status: "sent", delivered: true, kept: true, summary: "bookingPorts.delivered" },
        { status: "waiting_decision", delivered: false, kept: true, summary: "bookingPorts.failed" },
        { status: "duplicate", delivered: false, kept: true, summary: "bookingPorts.failed" },
        { status: "no_smtp", delivered: false, kept: false, summary: "bookingPorts.failed" },
        { status: "blocked", delivered: false, kept: false, summary: "bookingPorts.failed" },
        { status: "failed", delivered: false, kept: false, summary: "bookingPorts.failed" },
        { status: "rate_limited", delivered: false, kept: false, summary: "bookingPorts.failed" },
    ])(
        "reports a $status email outcome when the booking has no conversation",
        async ({ status, delivered, kept, summary }) => {
            const { service, conversations, messages, channels, mailer, events, catalog } = await build()
            mailer.requestCustomerEmail.mockResolvedValue({ status })

            await expect(service.notify(noticeOf({ conversationId: null }))).resolves.toEqual({
                delivered,
                kept,
                via: "email",
            })

            expect(conversations.targetOf).not.toHaveBeenCalled()
            expect(messages.storeAgentLine).not.toHaveBeenCalled()
            expect(channels.deliver).not.toHaveBeenCalled()
            expect(mailer.requestCustomerEmail.mock.calls).toEqual([[EMAIL]])
            expect(events.record.mock.calls).toEqual([[{ ...EVIDENCE, summary }]])
            expect(catalog.get.mock.calls).toEqual([
                ["bookings.evidence.actor", {}, "vi"],
                [summary, { channel: "email" }, "vi"],
            ])
        },
    )
})

describe("BookingNotifierService", () => {
    it.each([null, "", " \t\n "])(
        "records failure without sending when no conversation or email exists (%p)",
        async (email) => {
            const { service, conversations, messages, channels, mailer, events, catalog } = await build()
            conversations.targetOf.mockResolvedValue(refused(ChatRecordsErrorCode.NotFound))

            await expect(service.notify(noticeOf({ email }))).resolves.toEqual({
                delivered: false,
                kept: false,
                via: "none",
            })

            expect(conversations.targetOf.mock.calls).toEqual([["ws-1", "conversation-1"]])
            expect(messages.storeAgentLine).not.toHaveBeenCalled()
            expect(channels.deliver).not.toHaveBeenCalled()
            expect(mailer.requestCustomerEmail).not.toHaveBeenCalled()
            expect(events.record.mock.calls).toEqual([[{ ...EVIDENCE, summary: "bookingPorts.failed" }]])
            expect(catalog.get.mock.calls).toEqual([
                ["bookings.evidence.actor", {}, "vi"],
                ["bookingPorts.failed", { channel: "none" }, "vi"],
            ])
        },
    )
})

describe("BookingNotifierService", () => {
    it.each([
        { delivered: true, summary: "bookingPorts.delivered" },
        { delivered: false, summary: "bookingPorts.failed" },
    ])(
        "swallows and logs an evidence failure while preserving delivered=$delivered",
        async ({ delivered, summary }) => {
            const { service, channels, events, logger } = await build()
            const failure = new Error("Evidence unavailable")
            channels.deliver.mockResolvedValue({
                delivered,
                outcome: delivered ? "acknowledged" : "rejected",
                failure: null,
            })
            events.record.mockRejectedValue(failure)

            await expect(service.notify(NOTICE)).resolves.toEqual({ delivered, kept: true, via: "telegram" })

            expect(channels.deliver.mock.calls).toEqual([[DELIVERY]])
            expect(events.record.mock.calls).toEqual([[{ ...EVIDENCE, summary }]])
            expect(logger.error.mock.calls).toEqual([
                [BookingPortsLogEvent.EvidenceFailed, failure, { workspaceId: "ws-1", bookingId: "booking-1" }],
            ])
        },
    )
})

describe("BookingNotifierService", () => {
    it("propagates a conversation lookup failure before storing or delivering", async () => {
        const { service, conversations, messages, channels, events, mailer } = await build()
        const failure = new Error("Conversation lookup unavailable")
        conversations.targetOf.mockRejectedValue(failure)

        await expect(service.notify(NOTICE)).rejects.toBe(failure)

        expect(messages.storeAgentLine).not.toHaveBeenCalled()
        expect(channels.deliver).not.toHaveBeenCalled()
        expect(mailer.requestCustomerEmail).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("propagates a storage failure without attempting delivery or recording a verdict", async () => {
        const { service, messages, channels, events, mailer } = await build()
        const failure = new Error("Message could not be stored")
        messages.storeAgentLine.mockRejectedValue(failure)

        await expect(service.notify(NOTICE)).rejects.toBe(failure)

        expect(channels.deliver).not.toHaveBeenCalled()
        expect(mailer.requestCustomerEmail).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })
})
