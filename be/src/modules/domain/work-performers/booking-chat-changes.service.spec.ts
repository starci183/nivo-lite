import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { BookingChatLookupService, BookingPublicService } from "@modules/domain/bookings"
import { WorkEngineService } from "@modules/domain/decisions"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { BookingChatTurn, ChatBookingRequest } from "./booking-chat.contracts"
import { BookingChatChangesService } from "./booking-chat-changes.service"

const NOW = "2026-10-11T18:30:00.000Z"
const START = "2026-10-13T02:00:00.000Z"
const NEW_START = "2026-10-14T07:30:00.000Z"

const serviceOf = builder<Awaited<ReturnType<BookingPublicService["catalogIn"]>>["services"][number]>({
    id: "service-1",
    name: "Haircut",
    description: "A haircut",
    durationMin: 60,
    bufferMin: 0,
    priceVnd: 200000,
    resourceKind: null,
    active: true,
})
const catalogOf = builder<Awaited<ReturnType<BookingPublicService["catalogIn"]>>>({
    timezone: "Asia/Ho_Chi_Minh",
    services: [serviceOf()],
})
const cancellableOf = builder<NonNullable<Awaited<ReturnType<BookingChatLookupService["nextOfChat"]>>>>({
    id: "booking-1",
    leadId: "booking-lead",
    startIso: START,
    serviceName: "Haircut",
    customerName: "Mai",
})
const requestOf = builder<ChatBookingRequest>({
    intent: "book",
    service: "Haircut",
    date: "2026-10-13",
    time: "09:00",
    from: null,
    to: null,
    partySize: 2,
    name: "Mai",
    phone: "0912 345 678",
    email: null,
    note: null,
})
const turnOf = builder<BookingChatTurn>({
    workspaceId: "ws-1",
    conversationId: "conv-1",
    leadId: "chat-lead",
    messageId: "message-1",
    visitorName: "Visitor",
    request: requestOf(),
})
const build = async () => {
    const bookings = mock<BookingPublicService>()
    bookings.catalogIn.mockResolvedValue(catalogOf())
    const lookup = mock<BookingChatLookupService>()
    lookup.nextOfChat.mockResolvedValue(cancellableOf())
    bookings.nextCancellable.mockResolvedValue(null)
    const engine = mock<WorkEngineService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingChatChangesService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: BookingPublicService, useValue: bookings },
            { provide: BookingChatLookupService, useValue: lookup },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { service: moduleRef.get(BookingChatChangesService), bookings, lookup, engine, catalog }
}

describe("BookingChatChangesService", () => {
    describe("apply", () => {
        it("opens a forced cancellation decision for the chat's booking with exact customer facts", async () => {
            const { service, bookings, lookup, engine, catalog } = await build()
            await expect(
                service.apply(turnOf({ request: requestOf({ intent: "cancel", note: "Plans changed" }) })),
            ).resolves.toEqual({
                reply: "performers.chatBooking.cancelWaiting|Haircut",
                state: "cancelWaiting",
            })
            expect(lookup.nextOfChat).toHaveBeenCalledWith(
                { workspaceId: "ws-1", leadId: "chat-lead", conversationId: "conv-1" },
                Date.parse(NOW),
            )
            expect(bookings.nextCancellable).not.toHaveBeenCalled()
            expect(bookings.catalogIn).not.toHaveBeenCalled()
            expect(engine.runWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "NIVO engine", locale: "vi" },
                {
                    action: "cancel_booking",
                    subject_type: "conversation",
                    subject_id: "conv-1",
                    lead_id: "booking-lead",
                    origin: "live",
                    preset: true,
                    noChain: true,
                    forceAsk: "unclear_outcome",
                    dedupeKey: "cancel_booking:booking:booking-1",
                    seed: {
                        summary: `performers.chatBooking.cancelSummary|Haircut|Mai|${START}`,
                        fields: {
                            booking_id: "booking-1",
                            start_at: START,
                            service: "Haircut",
                            customer_name: "Mai",
                            conversation_id: "conv-1",
                            reason: "Plans changed",
                        },
                    },
                },
            )
            expect(catalog.get.mock.calls).toEqual([
                ["performers.chatBooking.cancelSummary", { service: "Haircut", name: "Mai", start: START }, "vi"],
                ["performers.chatBooking.cancelWaiting", { service: "Haircut" }, "vi"],
            ])
        })

        it("falls back to the supplied phone and the chat's lead when the chat has no booking", async () => {
            const { service, bookings, lookup, engine } = await build()
            lookup.nextOfChat.mockResolvedValue(null)
            bookings.nextCancellable.mockResolvedValue(cancellableOf({ leadId: null }))
            await expect(service.apply(turnOf({ request: requestOf({ intent: "cancel" }) }))).resolves.toEqual({
                reply: "performers.chatBooking.cancelWaiting|Haircut",
                state: "cancelWaiting",
            })
            expect(bookings.nextCancellable).toHaveBeenCalledWith("ws-1", "0912 345 678", Date.parse(NOW))
            expect(engine.runWork.mock.calls[0]?.[1]).toMatchObject({
                subject_type: "conversation",
                subject_id: "conv-1",
                lead_id: "chat-lead",
                seed: { fields: { reason: "" } },
            })
        })

        it("asks for the booking contact when neither a chat booking nor a phone is available", async () => {
            const { service, bookings, lookup, engine, catalog } = await build()
            lookup.nextOfChat.mockResolvedValue(null)
            await expect(
                service.apply(turnOf({ request: requestOf({ intent: "cancel", phone: null }) })),
            ).resolves.toEqual({
                reply: "performers.chatBooking.notFound",
                state: "notFound",
            })
            expect(catalog.get).toHaveBeenCalledWith("performers.chatBooking.notFound", {}, "vi")
            expect(bookings.nextCancellable).not.toHaveBeenCalled()
            expect(engine.runWork).not.toHaveBeenCalled()
        })

        it("opens no change decision when both chat and phone lookups find nothing", async () => {
            const { service, bookings, lookup, engine } = await build()
            lookup.nextOfChat.mockResolvedValue(null)
            await expect(service.apply(turnOf({ request: requestOf({ intent: "reschedule" }) }))).resolves.toEqual({
                reply: "performers.chatBooking.notFound",
                state: "notFound",
            })
            expect(bookings.nextCancellable).toHaveBeenCalledWith("ws-1", "0912 345 678", Date.parse(NOW))
            expect(engine.runWork).not.toHaveBeenCalled()
            expect(bookings.catalogIn).not.toHaveBeenCalled()
        })

        it.each([requestOf({ intent: "reschedule", date: null }), requestOf({ intent: "reschedule", time: null })])(
            "asks for a complete new time before opening a reschedule decision ($date, $time)",
            async (request) => {
                const { service, bookings, engine, catalog } = await build()
                await expect(service.apply(turnOf({ request }))).resolves.toEqual({
                    reply: "performers.chatBooking.askNewTime|Haircut",
                    state: "askNewTime",
                })
                expect(catalog.get).toHaveBeenCalledWith(
                    "performers.chatBooking.askNewTime",
                    { service: "Haircut" },
                    "vi",
                )
                expect(bookings.catalogIn).not.toHaveBeenCalled()
                expect(engine.runWork).not.toHaveBeenCalled()
            },
        )

        it("opens a reschedule decision with a local new time and retains the normal chat reply", async () => {
            const { service, bookings, lookup, engine, catalog } = await build()
            lookup.nextOfChat.mockResolvedValue(cancellableOf({ leadId: null }))
            await expect(
                service.apply(
                    turnOf({
                        leadId: null,
                        request: requestOf({ intent: "reschedule", date: "2026-10-14", time: "14:30" }),
                    }),
                ),
            ).resolves.toEqual({ reply: null, state: "reschedule_asked" })
            expect(bookings.catalogIn).toHaveBeenCalledWith("ws-1")
            expect(bookings.freeTimesIn).not.toHaveBeenCalled()
            expect(bookings.requestIn).not.toHaveBeenCalled()
            expect(engine.runWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "NIVO engine", locale: "vi" },
                {
                    action: "reschedule",
                    subject_type: "conversation",
                    subject_id: "conv-1",
                    lead_id: null,
                    origin: "live",
                    preset: true,
                    noChain: true,
                    dedupeKey: `reschedule:booking:booking-1:${NEW_START}`,
                    seed: {
                        summary: `performers.chatBooking.rescheduleSummary|Haircut|Mai|${START}|${NEW_START}`,
                        fields: {
                            booking_id: "booking-1",
                            start_at: START,
                            service: "Haircut",
                            customer_name: "Mai",
                            conversation_id: "conv-1",
                            new_start: NEW_START,
                        },
                    },
                },
            )
            expect(catalog.get).toHaveBeenCalledWith(
                "performers.chatBooking.rescheduleSummary",
                { service: "Haircut", name: "Mai", start: START, to: NEW_START },
                "vi",
            )
        })
    })
})
