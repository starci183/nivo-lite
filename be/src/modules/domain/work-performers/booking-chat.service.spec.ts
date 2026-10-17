import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { BookingWaitlistService } from "@modules/domain/booking-waitlist"
import { BookingPublicService } from "@modules/domain/bookings"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { BookingChatTurn, ChatBookingRequest } from "./booking-chat.contracts"
import { BookingChatChangesService } from "./booking-chat-changes.service"
import { BookingChatService } from "./booking-chat.service"

const NOW = "2026-10-11T18:30:00.000Z"
const START = "2026-10-13T02:00:00.000Z"

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
const resultOf = builder<Awaited<ReturnType<BookingPublicService["requestIn"]>>>({
    ok: true,
    state: "confirmed",
    code: "confirmed",
    serviceName: "Haircut",
    startIso: START,
    alternatives: [],
    bookingId: "booking-1",
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
const placementOf = builder<Parameters<BookingPublicService["requestIn"]>[0]>({
    workspaceId: "ws-1",
    sourceChannel: "chat",
    serviceId: "service-1",
    start: START,
    name: "Mai",
    phone: "84912345678",
    email: "",
    party: 2,
    note: "",
    token: `chat:message-1:${START}`,
    conversationId: "conv-1",
    leadId: "chat-lead",
})
const waitlistEntryOf = builder<Parameters<BookingWaitlistService["join"]>[0]>({
    workspaceId: "ws-1",
    leadId: "chat-lead",
    conversationId: "conv-1",
    customerName: "Mai",
    customerPhone: "84912345678",
    serviceId: "service-1",
    windowStart: "2026-10-12T17:00:00.000Z",
    windowEnd: "2026-10-13T17:00:00.000Z",
    partySize: 2,
    note: "",
})

const build = async () => {
    const bookings = mock<BookingPublicService>()
    bookings.catalogIn.mockResolvedValue(catalogOf())
    bookings.freeTimesIn.mockResolvedValue({ times: [START] })
    bookings.requestIn.mockResolvedValue(resultOf())
    const waitlist = mock<BookingWaitlistService>()
    const changes = mock<BookingChatChangesService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params = {}) => [key, ...Object.values(params).map(String)].join("|"))
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingChatService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: BookingPublicService, useValue: bookings },
            { provide: BookingWaitlistService, useValue: waitlist },
            { provide: BookingChatChangesService, useValue: changes },
        ],
    }).compile()
    return { service: moduleRef.get(BookingChatService), bookings, waitlist, changes, catalog }
}

describe("BookingChatService brief", () => {
    it("renders the shop's local day and each service's length and optional price", async () => {
        const { service, bookings, catalog } = await build()
        bookings.catalogIn.mockResolvedValue(
            catalogOf({ services: [serviceOf(), serviceOf({ name: "Massage", durationMin: 30, priceVnd: null })] }),
        )
        await expect(service.brief("ws-1")).resolves.toBe(
            "performers.chatBooking.briefHeader|2026-10-12|Asia/Ho_Chi_Minh\n" +
                "performers.chatBooking.briefService|Haircut|60|200000\n" +
                "performers.chatBooking.briefService|Massage|30|-",
        )
        expect(bookings.catalogIn).toHaveBeenCalledWith("ws-1")
        expect(catalog.get.mock.calls).toEqual([
            ["performers.chatBooking.briefService", { name: "Haircut", minutes: "60", price: "200000" }, "vi"],
            ["performers.chatBooking.briefService", { name: "Massage", minutes: "30", price: "-" }, "vi"],
            ["performers.chatBooking.briefHeader", { today: "2026-10-12", zone: "Asia/Ho_Chi_Minh" }, "vi"],
        ])
    })
})

describe("BookingChatService changes", () => {
    it.each([
        {
            request: requestOf({ intent: "cancel" }),
            answer: { reply: "Cancellation pending", state: "cancelWaiting" },
        },
        { request: requestOf({ intent: "reschedule" }), answer: { reply: null, state: "reschedule_asked" } },
    ])("delegates $request.intent and returns its answer", async ({ request, answer }) => {
        const { service, bookings, waitlist, changes, catalog } = await build()
        changes.apply.mockResolvedValue(answer)
        const turn = turnOf({ request })
        await expect(service.apply(turn)).resolves.toBe(answer)
        expect(changes.apply).toHaveBeenCalledTimes(1)
        expect(changes.apply).toHaveBeenCalledWith(turn)
        expect(bookings.catalogIn).not.toHaveBeenCalled()
        expect(bookings.freeTimesIn).not.toHaveBeenCalled()
        expect(bookings.requestIn).not.toHaveBeenCalled()
        expect(waitlist.join).not.toHaveBeenCalled()
        expect(catalog.get).not.toHaveBeenCalled()
    })
})

describe("BookingChatService availability", () => {
    it("asks for an available service when the supplied name is unknown", async () => {
        const { service, bookings, catalog } = await build()
        bookings.catalogIn.mockResolvedValue(catalogOf({ services: [serviceOf(), serviceOf({ name: "Massage" })] }))
        await expect(service.apply(turnOf({ request: requestOf({ service: "Unknown" }) }))).resolves.toEqual({
            reply: "performers.chatBooking.askService|Haircut, Massage",
            state: "askService",
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.chatBooking.askService",
            { services: "Haircut, Massage" },
            "vi",
        )
        expect(bookings.catalogIn).toHaveBeenCalledWith("ws-1")
        expect(bookings.freeTimesIn).not.toHaveBeenCalled()
    })

    it("uses a dash when the service catalog is empty", async () => {
        const { service, bookings, catalog } = await build()
        bookings.catalogIn.mockResolvedValue(catalogOf({ services: [] }))
        await expect(service.apply(turnOf())).resolves.toEqual({
            reply: "performers.chatBooking.askService|-",
            state: "askService",
        })
        expect(catalog.get).toHaveBeenCalledWith("performers.chatBooking.askService", { services: "-" }, "vi")
        expect(bookings.freeTimesIn).not.toHaveBeenCalled()
    })

    it.each([requestOf({ date: null }), requestOf({ intent: "waitlist", date: null })])(
        "asks for a day before searching or joining for $intent",
        async (request) => {
            const { service, bookings, waitlist, catalog } = await build()
            await expect(service.apply(turnOf({ request }))).resolves.toEqual({
                reply: "performers.chatBooking.askDate|Haircut",
                state: "askDate",
            })
            expect(catalog.get).toHaveBeenCalledWith("performers.chatBooking.askDate", { service: "Haircut" }, "vi")
            expect(bookings.freeTimesIn).not.toHaveBeenCalled()
            expect(waitlist.join).not.toHaveBeenCalled()
        },
    )
})

describe("BookingChatService availability", () => {
    it("offers five distinct local times inside the requested period without placing a booking", async () => {
        const { service, bookings, catalog } = await build()
        bookings.freeTimesIn.mockResolvedValue({
            times: [
                "2026-10-13T01:30:00.000Z",
                START,
                START,
                "2026-10-13T02:30:00.000Z",
                "2026-10-13T03:00:00.000Z",
                "2026-10-13T03:30:00.000Z",
                "2026-10-13T04:00:00.000Z",
                "2026-10-13T04:30:00.000Z",
                "2026-10-13T05:00:00.000Z",
            ],
        })
        await expect(
            service.apply(turnOf({ request: requestOf({ intent: "availability", from: "09:00", to: "12:00" }) })),
        ).resolves.toEqual({
            reply: "performers.chatBooking.offerTimes|Haircut|2026-10-13|09:00, 09:30, 10:00, 10:30, 11:00",
            state: "offerTimes",
        })
        expect(bookings.freeTimesIn).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            service: "service-1",
            date: "2026-10-13",
            party: 2,
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.chatBooking.offerTimes",
            { service: "Haircut", date: "2026-10-13", times: "09:00, 09:30, 10:00, 10:30, 11:00" },
            "vi",
        )
        expect(bookings.requestIn).not.toHaveBeenCalled()
    })

    it("offers times for a booking request that has not selected a time", async () => {
        const { service, bookings, catalog } = await build()
        await expect(service.apply(turnOf({ request: requestOf({ time: null, phone: null }) }))).resolves.toEqual({
            reply: "performers.chatBooking.offerTimes|Haircut|2026-10-13|09:00",
            state: "offerTimes",
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.chatBooking.offerTimes",
            { service: "Haircut", date: "2026-10-13", times: "09:00" },
            "vi",
        )
        expect(bookings.requestIn).not.toHaveBeenCalled()
    })

    it("answers that no times remain when the requested period excludes every slot", async () => {
        const { service, bookings, catalog } = await build()
        await expect(
            service.apply(turnOf({ request: requestOf({ intent: "availability", from: "10:00" }) })),
        ).resolves.toEqual({ reply: "performers.chatBooking.noTimes|Haircut|2026-10-13", state: "noTimes" })
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.chatBooking.noTimes",
            { service: "Haircut", date: "2026-10-13" },
            "vi",
        )
        expect(bookings.requestIn).not.toHaveBeenCalled()
    })
})

describe("BookingChatService booking requests", () => {
    it.each([
        { name: "", visitorName: "", phone: "0912345678" },
        { name: "Mai", visitorName: "Visitor", phone: null },
        { name: "Mai", visitorName: "Visitor", phone: "letters" },
    ])("asks for contact details when name=$name and phone=$phone", async ({ name, visitorName, phone }) => {
        const { service, bookings, catalog } = await build()
        await expect(service.apply(turnOf({ visitorName, request: requestOf({ name, phone }) }))).resolves.toEqual({
            reply: "performers.chatBooking.askContact|Haircut",
            state: "askContact",
        })
        expect(catalog.get).toHaveBeenCalledWith("performers.chatBooking.askContact", { service: "Haircut" }, "vi")
        expect(bookings.requestIn).not.toHaveBeenCalled()
    })

    it("places an exact chat request with normalized contact and returns no duplicate confirmation text", async () => {
        const { service, bookings, catalog } = await build()
        await expect(
            service.apply(turnOf({ request: requestOf({ email: "mai@example.test", note: "First visit" }) })),
        ).resolves.toEqual({ reply: null, state: "confirmed" })
        expect(bookings.requestIn).toHaveBeenCalledWith(placementOf({ email: "mai@example.test", note: "First visit" }))
        expect(catalog.get).not.toHaveBeenCalled()
    })

    it("uses the visitor's name and empty optional fields when the request omits them", async () => {
        const { service, bookings } = await build()
        await expect(service.apply(turnOf({ leadId: null, request: requestOf({ name: "" }) }))).resolves.toEqual({
            reply: null,
            state: "confirmed",
        })
        expect(bookings.requestIn).toHaveBeenCalledWith(placementOf({ name: "Visitor", leadId: null }))
    })

    it("uses the same placement token for retries of a customer's message and slot", async () => {
        const { service, bookings } = await build()
        const turn = turnOf()
        await expect(service.apply(turn)).resolves.toEqual({ reply: null, state: "confirmed" })
        await expect(service.apply(turn)).resolves.toEqual({ reply: null, state: "confirmed" })

        expect(bookings.requestIn.mock.calls.map(([request]) => request.token)).toEqual([
            `chat:message-1:${START}`,
            `chat:message-1:${START}`,
        ])
    })

    it.each([
        { result: resultOf({ state: "waiting", code: "received_free" }), state: "requestHeld" },
        { result: resultOf({ state: "waiting", code: "received_taken" }), state: "requestTaken" },
        {
            result: resultOf({ ok: false, state: "failed", code: "no_resource", bookingId: null }),
            state: "requestInvalid",
        },
    ])("returns the catalog's $state reply for placement $result.code", async ({ result, state }) => {
        const { service, bookings, catalog } = await build()
        bookings.requestIn.mockResolvedValue(result)
        await expect(service.apply(turnOf())).resolves.toEqual({
            reply: `performers.chatBooking.${state}|Haircut`,
            state,
        })
        expect(bookings.requestIn).toHaveBeenCalledWith(placementOf())
        expect(catalog.get).toHaveBeenCalledWith(`performers.chatBooking.${state}`, { service: "Haircut" }, "vi")
    })
})

describe("BookingChatService booking requests", () => {
    it("offers five distinct local alternatives when the requested slot was taken", async () => {
        const { service, bookings, catalog } = await build()
        bookings.requestIn.mockResolvedValue(
            resultOf({
                state: "waiting",
                code: "received_taken",
                alternatives: [
                    START,
                    START,
                    "2026-10-13T03:00:00.000Z",
                    "2026-10-13T04:00:00.000Z",
                    "2026-10-13T05:00:00.000Z",
                    "2026-10-13T06:00:00.000Z",
                    "2026-10-13T07:00:00.000Z",
                ],
            }),
        )
        await expect(service.apply(turnOf())).resolves.toEqual({
            reply: "performers.chatBooking.requestTakenOffer|Haircut|09:00, 10:00, 11:00, 12:00, 13:00",
            state: "requestTakenOffer",
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.chatBooking.requestTakenOffer",
            { service: "Haircut", times: "09:00, 10:00, 11:00, 12:00, 13:00" },
            "vi",
        )
    })
})

describe("BookingChatService waitlist", () => {
    it.each([null, undefined])("defaults a date changed to %s while free times are awaited", async (date) => {
        const { service, bookings, waitlist, catalog } = await build()
        const request = requestOf({ intent: "waitlist" })
        bookings.freeTimesIn.mockImplementation(() => {
            Object.assign(request, { date })
            return Promise.resolve({ times: [] })
        })
        await expect(service.apply(turnOf({ request }))).resolves.toEqual({
            reply: "performers.chatBooking.waitlisted|Haircut|",
            state: "waitlisted",
        })
        expect(bookings.freeTimesIn).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            service: "service-1",
            date: "2026-10-13",
            party: 2,
        })
        expect(waitlist.join).toHaveBeenCalledWith(
            waitlistEntryOf({
                windowStart: "1899-11-29T16:53:00.000Z",
                windowEnd: "1899-11-30T16:53:00.000Z",
            }),
        )
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.chatBooking.waitlisted",
            { service: "Haircut", date: "" },
            "vi",
        )
        expect(bookings.requestIn).not.toHaveBeenCalled()
    })

    it("joins the named period with normalized customer details and the chat context", async () => {
        const { service, bookings, waitlist, catalog } = await build()
        await expect(
            service.apply(
                turnOf({
                    request: requestOf({ intent: "waitlist", from: "13:00", to: "17:00", note: "Either chair" }),
                }),
            ),
        ).resolves.toEqual({ reply: "performers.chatBooking.waitlisted|Haircut|2026-10-13", state: "waitlisted" })
        expect(waitlist.join).toHaveBeenCalledWith(
            waitlistEntryOf({
                windowStart: "2026-10-13T06:00:00.000Z",
                windowEnd: "2026-10-13T10:00:00.000Z",
                note: "Either chair",
            }),
        )
        expect(bookings.freeTimesIn).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            service: "service-1",
            date: "2026-10-13",
            party: 2,
        })
        expect(catalog.get).toHaveBeenCalledWith(
            "performers.chatBooking.waitlisted",
            { service: "Haircut", date: "2026-10-13" },
            "vi",
        )
        expect(bookings.requestIn).not.toHaveBeenCalled()
    })
})

describe("BookingChatService waitlist", () => {
    it("defaults an open period to the whole local day and uses the visitor's name", async () => {
        const { service, waitlist } = await build()
        await expect(
            service.apply(turnOf({ leadId: null, request: requestOf({ intent: "waitlist", name: "", phone: null }) })),
        ).resolves.toEqual({ reply: "performers.chatBooking.waitlisted|Haircut|2026-10-13", state: "waitlisted" })
        expect(waitlist.join).toHaveBeenCalledWith(
            waitlistEntryOf({
                leadId: null,
                customerName: "Visitor",
                customerPhone: null,
            }),
        )
    })

    it("uses the requested calendar date for an open waitlist period across the year boundary", async () => {
        const { service, bookings, waitlist } = await build()
        await expect(
            service.apply(turnOf({ request: requestOf({ intent: "waitlist", date: "2026-12-31" }) })),
        ).resolves.toEqual({
            reply: "performers.chatBooking.waitlisted|Haircut|2026-12-31",
            state: "waitlisted",
        })
        expect(bookings.freeTimesIn).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            service: "service-1",
            date: "2026-12-31",
            party: 2,
        })
        expect(waitlist.join).toHaveBeenCalledWith(
            waitlistEntryOf({
                windowStart: "2026-12-30T17:00:00.000Z",
                windowEnd: "2026-12-31T17:00:00.000Z",
            }),
        )
    })
})
