import type { NewBooking } from "./booking-reservation.service"
import { DEFAULT_SETTINGS } from "./persistence/booking.rows"
import {
    HOUR,
    WORKSPACE,
    PAGE,
    NOW,
    MONDAY_NINE,
    CHAT_KEY,
    CHAT_LINK,
    ALTERNATIVES,
    bookingRequestOf,
    workspaceRequestOf,
    replyOf,
    nextReplyOf,
    failureOf,
} from "../../../tests/fixtures/builders/booking-public.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingModelService } from "./booking-model.service"
import { BookingPublicService } from "./booking-public.service"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { BookingReservationService } from "./booking-reservation.service"
import type { BookableService, BookingModel, TakenSpan } from "./bookings.contracts"
import { BookingsErrorCode } from "./errors/bookings.error"
import { SELECT_PAGE_BY_SLUG } from "./persistence/booking-model.sql"
import { SELECT_BOOKING_BY_KEY, SELECT_NEXT_CANCELLABLE_BOOKING } from "./persistence/booking-write.sql"
import type { CancellableBookingRow, KeyedBookingRow } from "./persistence/booking.rows"

const anything = (): unknown => expect.anything()

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const serviceOf = builder<BookableService>({
    id: "s1",
    name: "Cut",
    description: "A cut",
    durationMin: 60,
    bufferMin: 0,
    priceVnd: 200000,
    resourceKind: null,
    active: true,
})
const bookingOf = builder<NewBooking>({
    workspaceId: WORKSPACE,
    customerName: "Mai",
    customerPhone: "84912345678",
    customerEmail: null,
    serviceId: "s1",
    resourceId: "r1",
    startMs: Date.parse(MONDAY_NINE),
    endMs: Date.parse(MONDAY_NINE) + HOUR,
    blockEndMs: Date.parse(MONDAY_NINE) + HOUR,
    partySize: 1,
    status: "confirmed",
    holdsSlot: true,
    sourceChannel: "public_page",
    priceVnd: 200000,
    depositVnd: 0,
    depositStatus: "none",
    note: "first visit",
    conflictNote: "",
    idempotencyKey: null,
    conversationId: null,
    leadId: null,
})
/** Expected chat reservation with its conversation, lead and idempotency identity. */
const chatBookingOf = (overrides: Partial<NewBooking> = {}) =>
    bookingOf({ ...overrides, ...CHAT_LINK, sourceChannel: "chat", idempotencyKey: CHAT_KEY })
/** Expected public form reservation with a normalized customer email. */
const publicBookingOf = (overrides: Partial<NewBooking> = {}) =>
    bookingOf({ ...overrides, customerEmail: "mai@example.com" })
const HELD_FORM_BOOKING = bookingOf({
    status: "requested",
    depositVnd: 100000,
    depositStatus: "due",
    idempotencyKey: "public:form-token-1",
})

const TAKEN_NINE: TakenSpan = {
    id: "b9",
    resourceId: "r1",
    startMs: Date.UTC(2026, 9, 12, 2),
    blockEndMs: Date.UTC(2026, 9, 12, 3),
    partySize: 1,
}
/** Expected next cancellable booking for a linked or unlinked lead. */

const settingsOf = builder({ ...DEFAULT_SETTINGS, slotStepMin: 60 })
const modelOf = builder<BookingModel>({
    settings: settingsOf(),
    services: [
        serviceOf(),
        serviceOf({ id: "s2", name: "Old", description: "", durationMin: 30, priceVnd: null, active: false }),
    ],
    resources: [{ id: "r1", name: "Anna", kind: "staff", capacity: 1, active: true, sort: 0 }],
    hours: [{ resourceId: "r1", weekday: 1, start: "09:00", end: "18:00" }],
    exceptions: [],
})
const reserveOf = (booking: NewBooking) => ({ manager: anything(), force: false, booking })
const SCHEDULE = {
    manager: anything(),
    workspaceId: WORKSPACE,
    bookingId: "b1",
    startMs: Date.parse(MONDAY_NINE),
    nowMs: NOW,
    defaultHours: [24, 2],
}
const NEXT_ROW: CancellableBookingRow = {
    id: "b-next",
    lead_id: "lead-1",
    customer_name: "Mai",
    service_name: "Cut",
    start_ms: Date.parse(MONDAY_NINE),
}

interface BuildOptions {
    readonly page?: boolean
    readonly keyed?: ReadonlyArray<KeyedBookingRow>
    readonly concurrentKeyed?: ReadonlyArray<KeyedBookingRow>
    readonly cancellable?: ReadonlyArray<CancellableBookingRow>
    readonly model?: BookingModel
    readonly spans?: ReadonlyArray<TakenSpan>
}

const build = async (options: BuildOptions = {}) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [
                [SELECT_PAGE_BY_SLUG, options.page === false ? [] : [PAGE]],
                [SELECT_BOOKING_BY_KEY, options.keyed ?? []],
                [SELECT_BOOKING_BY_KEY, options.concurrentKeyed ?? options.keyed ?? []],
                [SELECT_NEXT_CANCELLABLE_BOOKING, options.cancellable ?? []],
            ],
        }),
    )
    const models = mock<BookingModelService>()
    models.model.mockResolvedValue(options.model ?? modelOf())
    models.spans.mockResolvedValue(options.spans ?? [])
    const reservation = mock<BookingReservationService>()
    reservation.reserve.mockResolvedValue({ kind: "reserved", id: "b1" })
    const reminders = mock<BookingRemindersService>()
    reminders.schedule.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingPublicService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: BookingModelService, useValue: models },
            { provide: BookingReservationService, useValue: reservation },
            { provide: BookingRemindersService, useValue: reminders },
        ],
    }).compile()
    return { service: moduleRef.get(BookingPublicService), models, reservation, reminders, tx }
}

const parkedOf = () => publicBookingOf({ status: "requested", holdsSlot: false, conflictNote: "full" })

describe("BookingPublicService", () => {
    describe("page", () => {
        it("shows the shop with its active services only", async () => {
            const { service } = await build()
            expect(await service.catalogIn(WORKSPACE)).toEqual({ timezone: PAGE.timezone, services: [serviceOf()] })
            await expect(service.page({ slug: "spa-anna" })).resolves.toEqual({
                shop: "Spa Anna",
                slug: "spa-anna",
                note: "Note",
                address: "1 Main St",
                timezone: "Asia/Ho_Chi_Minh",
                services: [{ id: "s1", name: "Cut", description: "A cut", durationMin: 60, priceVnd: 200000 }],
            })
        })

        it("refuses a slug no published page has", async () => {
            const { service } = await build({ page: false })
            await expect(service.page({ slug: "nobody" })).rejects.toMatchObject({
                code: BookingsErrorCode.PageNotFound,
            })
        })
    })

    describe("freeTimes", () => {
        it.each([
            { spans: [], count: 9, first: MONDAY_NINE },
            { spans: [TAKEN_NINE], count: 8, first: ALTERNATIVES[0] },
        ])("lists $count distinct free starts with existing holds", async ({ spans, count, first }) => {
            const { service, models } = await build({ spans })
            const { times } = await service.freeTimes({ slug: "spa-anna", service: "s1", date: "2026-10-12", party: 1 })
            expect(times[0]).toBe(first)
            expect(times).toHaveLength(count)
            expect(new Set(times).size).toBe(count)
            expect(models.spans).toHaveBeenCalledWith(
                WORKSPACE,
                Date.UTC(2026, 9, 11, 17),
                Date.UTC(2026, 9, 12, 17) + 86_400_000,
                "Asia/Ho_Chi_Minh",
            )
        })

        it.each(["s2", "nope"])("offers nothing for unavailable service %s", async (serviceId) => {
            const { service, models } = await build()
            await expect(
                service.freeTimes({ slug: "spa-anna", service: serviceId, date: "2026-10-12", party: 1 }),
            ).resolves.toEqual({ times: [] })
            expect(models.spans).not.toHaveBeenCalled()
        })

        it("refuses an unknown slug", async () => {
            const { service } = await build({ page: false })
            await expect(
                service.freeTimes({ slug: "nobody", service: "s1", date: "2026-10-12", party: 1 }),
            ).rejects.toMatchObject({ code: BookingsErrorCode.PageNotFound })
        })
    })

    describe("freeTimesIn", () => {
        it("reads the workspace calendar when no public page is published", async () => {
            const { service, models, tx } = await build({ page: false, spans: [TAKEN_NINE] })
            const query = { workspaceId: WORKSPACE, service: "s1", date: "2026-10-12", party: 1 }
            const result = await service.freeTimesIn(query)
            expect(result.times).toHaveLength(8)
            expect(result.times[0]).toBe(ALTERNATIVES[0])
            expect(result.times).not.toContain(MONDAY_NINE)
            expect(models.model).toHaveBeenCalledWith(WORKSPACE)
            expect(tx.em.query).not.toHaveBeenCalled()
        })
    })
})

describe("BookingPublicService", () => {
    describe("nextCancellable", () => {
        it("returns the next booking for a normalised phone scoped to the workspace", async () => {
            const { service, tx } = await build({ cancellable: [NEXT_ROW] })
            await expect(service.nextCancellable(WORKSPACE, "", NOW)).resolves.toBeNull()
            await expect(service.nextCancellable(WORKSPACE, "0912 345 678", NOW)).resolves.toEqual(
                nextReplyOf("lead-1"),
            )
            const query = [WORKSPACE, "84912345678", new Date(NOW).toISOString()]
            expect(tx.em.query).toHaveBeenCalledWith(SELECT_NEXT_CANCELLABLE_BOOKING, query)
        })
    })

    describe.each(["book", "requestIn"])("%s placement", (method) => {
        it.each([
            {
                label: "confirmed",
                autoConfirm: true,
                spans: [],
                reply: replyOf(),
                booking: bookingOf(),
                scheduled: true,
            },
            {
                label: "held",
                autoConfirm: false,
                spans: [],
                scheduled: false,
                reply: replyOf({ state: "waiting", code: "received_free" }),
                booking: bookingOf({ status: "requested" }),
            },
            {
                label: "parked",
                autoConfirm: true,
                spans: [TAKEN_NINE],
                scheduled: false,
                reply: replyOf({ state: "waiting", code: "received_taken", alternatives: ALTERNATIVES }),
                booking: bookingOf({ status: "requested", holdsSlot: false, conflictNote: "full" }),
            },
        ])("records a $label request with normalized details, links, keys and reminder policy", async (params) => {
            const chat = method === "requestIn"
            const heldForm = !chat && !params.autoConfirm
            const model = modelOf({
                settings: settingsOf({ autoConfirm: params.autoConfirm, depositPct: heldForm ? 50 : 0 }),
            })
            const { service, reservation, reminders, tx } = await build({ page: !chat, model, spans: params.spans })
            const form = bookingRequestOf(heldForm ? { token: "form-token-1", email: "nope" } : {})
            const result = chat ? service.requestIn(workspaceRequestOf(CHAT_LINK)) : service.book(form)
            await expect(result).resolves.toEqual(params.reply)
            const booking = chat
                ? chatBookingOf(params.booking)
                : heldForm
                  ? HELD_FORM_BOOKING
                  : publicBookingOf(params.booking)
            expect(reservation.reserve).toHaveBeenCalledTimes(1)
            expect(reservation.reserve).toHaveBeenCalledWith(reserveOf(booking))
            if (chat) expect(tx.em.query).toHaveBeenCalledWith(SELECT_BOOKING_BY_KEY, [WORKSPACE, CHAT_KEY])
            if (params.scheduled) expect(reminders.schedule).toHaveBeenCalledWith(SCHEDULE)
            else expect(reminders.schedule).not.toHaveBeenCalled()
            expect(tx.commits).toBe(1)
        })
    })
})

describe("BookingPublicService", () => {
    describe("requestIn", () => {
        it("keeps null links and skips keyed lookup for a chat request without a token", async () => {
            const { service, reservation, tx } = await build()
            await expect(
                service.requestIn(workspaceRequestOf({ token: "", conversationId: null, leadId: null })),
            ).resolves.toEqual(replyOf())
            expect(tx.em.query).not.toHaveBeenCalled()
            expect(reservation.reserve).toHaveBeenCalledWith(reserveOf(bookingOf({ sourceChannel: "chat" })))
        })

        it("answers an existing chat request without reserving it again", async () => {
            const { service, models, reservation, reminders, tx } = await build({
                keyed: [{ id: "b-existing", status: "confirmed", holds_slot: true }],
            })
            await expect(service.requestIn(workspaceRequestOf())).resolves.toEqual(replyOf({ bookingId: "b-existing" }))
            expect(tx.em.query).toHaveBeenCalledWith(SELECT_BOOKING_BY_KEY, [WORKSPACE, CHAT_KEY])
            expect(tx.em.query).toHaveBeenCalledTimes(1)
            expect(tx.em.transaction).not.toHaveBeenCalled()
            expect(models.spans).not.toHaveBeenCalled()
            expect(reservation.reserve).not.toHaveBeenCalled()
            expect(reminders.schedule).not.toHaveBeenCalled()
        })

        it.each([
            { code: "23505" },
            { driverError: { code: "23505" } },
            { code: "wrapped", driverError: { code: "23505" } },
        ])("answers the concurrent chat booking after unique failure %j", async (cause) => {
            const { service, reservation, reminders, tx } = await build({
                concurrentKeyed: [{ id: "b-concurrent", status: "confirmed", holds_slot: true }],
            })
            reservation.reserve.mockRejectedValueOnce(cause)
            await expect(service.requestIn(workspaceRequestOf())).resolves.toEqual(
                replyOf({ bookingId: "b-concurrent" }),
            )
            expect(tx.em.query).toHaveBeenNthCalledWith(1, SELECT_BOOKING_BY_KEY, [WORKSPACE, CHAT_KEY])
            expect(tx.em.query).toHaveBeenNthCalledWith(2, SELECT_BOOKING_BY_KEY, [WORKSPACE, CHAT_KEY])
            expect(tx.em.query).toHaveBeenCalledTimes(2)
            expect(reservation.reserve).toHaveBeenCalledTimes(1)
            expect(tx.rollbacks).toBe(1)
            expect(tx.commits).toBe(0)
            expect(reminders.schedule).not.toHaveBeenCalled()
        })
    })
})

describe("BookingPublicService", () => {
    describe("requestIn", () => {
        it.each([
            failureOf({ label: "missing concurrent row", cause: { code: "23505" }, reads: 2 }),
            failureOf({
                label: "tokenless chat",
                cause: { code: "23505" },
                request: workspaceRequestOf({ token: "" }),
                key: null,
                reads: 0,
            }),
            failureOf({
                label: "public unique failure",
                cause: { code: "23505" },
                key: "public:form-token-1",
                request: workspaceRequestOf({ sourceChannel: "public_page", token: "form-token-1" }),
            }),
            failureOf({ label: "null", cause: null }),
            failureOf({ label: "nonobject", cause: "database unavailable" }),
            failureOf(),
            failureOf({ label: "other code", cause: { code: "40001" } }),
            failureOf({ label: "driver code", cause: { driverError: { code: "40001" } } }),
        ])("rethrows $label with $reads keyed lookups", async ({ cause, request, key, reads }) => {
            const { service, reservation, tx } = await build()
            reservation.reserve.mockRejectedValueOnce(cause)
            await expect(service.requestIn(request)).rejects.toBe(cause)
            expect(tx.em.query).toHaveBeenCalledTimes(reads)
            if (key !== null) expect(tx.em.query).toHaveBeenCalledWith(SELECT_BOOKING_BY_KEY, [WORKSPACE, key])
            expect(tx.rollbacks).toBe(1)
        })
    })
})

describe("BookingPublicService", () => {
    describe("book", () => {
        it("parks the request when another request took the free time first", async () => {
            const { service, reservation } = await build()
            reservation.reserve.mockResolvedValueOnce({ kind: "full" })
            await expect(service.book(bookingRequestOf())).resolves.toMatchObject({
                state: "waiting",
                code: "received_taken",
                bookingId: "b1",
            })
            expect(reservation.reserve).toHaveBeenCalledTimes(2)
            expect(reservation.reserve).toHaveBeenLastCalledWith(reserveOf(parkedOf()))
        })

        it("records why a time outside the opening hours cannot be taken", async () => {
            const { service, reservation } = await build()
            await service.book(bookingRequestOf({ start: "2026-10-12T14:00:00.000Z" }))
            expect(reservation.reserve).toHaveBeenCalledWith(
                expect.objectContaining({
                    booking: objectLike({ holdsSlot: false, conflictNote: "closed" }),
                }),
            )
        })

        it.each([
            { label: "no resource to park on", model: modelOf({ resources: [] }), spans: [], failsWrite: false },
            { label: "parked request cannot be written", model: modelOf(), spans: [TAKEN_NINE], failsWrite: true },
        ])("fails when there is $label", async ({ model, spans, failsWrite }) => {
            const { service, reservation } = await build({ model, spans })
            if (failsWrite) reservation.reserve.mockResolvedValueOnce({ kind: "resource_not_found" })
            await expect(service.book(bookingRequestOf())).resolves.toEqual(
                replyOf({ ok: false, state: "failed", code: "no_resource", bookingId: null }),
            )
        })

        it.each([
            { row: { id: "b7", status: "confirmed", holds_slot: true }, reply: replyOf({ bookingId: "b7" }) },
            {
                row: { id: "b8", status: "requested", holds_slot: true },
                reply: replyOf({ state: "waiting", code: "received_free", bookingId: "b8" }),
            },
            {
                row: { id: "b9", status: "requested", holds_slot: false },
                reply: replyOf({ state: "waiting", code: "received_taken", bookingId: "b9" }),
            },
        ])("answers a repeated form from existing booking $row.id", async ({ row, reply }) => {
            const { service, reservation } = await build({ keyed: [row] })
            await expect(service.book(bookingRequestOf({ token: "form-token-1" }))).resolves.toEqual(reply)
            expect(reservation.reserve).not.toHaveBeenCalled()
        })

        it("drops a bot that filled the honeypot without writing anything", async () => {
            const { service, reservation, models } = await build()
            await expect(service.book(bookingRequestOf({ website: "http://spam" }))).resolves.toEqual(
                replyOf({
                    state: "waiting",
                    code: "received_free",
                    serviceName: "",
                    startIso: "",
                    bookingId: null,
                }),
            )
            expect(models.model).not.toHaveBeenCalled()
            expect(reservation.reserve).not.toHaveBeenCalled()
        })
    })
})

describe("BookingPublicService", () => {
    describe("book", () => {
        it.each([
            { request: bookingRequestOf({ name: "  " }), code: "name_required" },
            { request: bookingRequestOf({ phone: "12" }), code: "phone_invalid" },
            { request: bookingRequestOf({ phone: "" }), code: "phone_invalid" },
            { request: bookingRequestOf({ start: "tomorrow" }), code: "start_invalid" },
            { request: bookingRequestOf({ serviceId: "s2" }), code: "service_unavailable" },
            { request: bookingRequestOf({ serviceId: "zzz" }), code: "service_unavailable" },
        ])("refuses $code before any write", async ({ request, code }) => {
            const { service, reservation } = await build()
            await expect(service.book(request)).resolves.toMatchObject({ ok: false, state: "invalid", code })
            expect(reservation.reserve).not.toHaveBeenCalled()
        })

        it("refuses an unknown slug", async () => {
            const { service } = await build({ page: false })
            await expect(service.book(bookingRequestOf())).rejects.toMatchObject({
                code: BookingsErrorCode.PageNotFound,
            })
        })
    })
})
