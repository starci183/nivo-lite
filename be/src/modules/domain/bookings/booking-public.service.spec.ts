import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingModelService } from "./booking-model.service"
import { BookingPublicService } from "./booking-public.service"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { BookingReservationService } from "./booking-reservation.service"
import type { BookingModel, PublicBookParams, TakenSpan } from "./bookings.contracts"
import { BookingsErrorCode } from "./errors/bookings.error"
import { SELECT_PAGE_BY_SLUG } from "./persistence/booking-model.sql"
import { SELECT_BOOKING_BY_KEY } from "./persistence/booking-write.sql"
import { DEFAULT_SETTINGS } from "./persistence/booking.rows"

const WORKSPACE = "ws-1"
const PAGE = {
    workspace_id: WORKSPACE,
    public_note: "Note",
    address: "1 Main St",
    timezone: "Asia/Ho_Chi_Minh",
    shop: "Spa Anna",
}
/** Sunday 12:00 in Ho Chi Minh City; the Monday after has hours from 09:00. */
const NOW = Date.UTC(2026, 9, 11, 5, 0)
const MONDAY_NINE = "2026-10-12T02:00:00.000Z"
const HOUR = 3_600_000

const modelOf = builder<BookingModel>({
    settings: { ...DEFAULT_SETTINGS, slotStepMin: 60 },
    services: [
        {
            id: "s1",
            name: "Cut",
            description: "A cut",
            durationMin: 60,
            bufferMin: 0,
            priceVnd: 200000,
            resourceKind: null,
            active: true,
        },
        {
            id: "s2",
            name: "Old",
            description: "",
            durationMin: 30,
            bufferMin: 0,
            priceVnd: null,
            resourceKind: null,
            active: false,
        },
    ],
    resources: [{ id: "r1", name: "Anna", kind: "staff", capacity: 1, active: true, sort: 0 }],
    hours: [{ resourceId: "r1", weekday: 1, start: "09:00", end: "18:00" }],
    exceptions: [],
})
const requestOf = builder<PublicBookParams>({
    slug: "spa-anna",
    serviceId: "s1",
    start: MONDAY_NINE,
    name: " Mai ",
    phone: "0912 345 678",
    email: "Mai@Example.com",
    party: 1,
    note: " first visit ",
    token: "",
    website: "",
})
const TAKEN_NINE: TakenSpan = {
    id: "b9",
    resourceId: "r1",
    startMs: Date.UTC(2026, 9, 12, 2),
    blockEndMs: Date.UTC(2026, 9, 12, 3),
    partySize: 1,
}

const build = async (
    options: {
        page?: boolean
        keyed?: Array<{ id: string; status: string; holds_slot: boolean }>
        model?: BookingModel
        spans?: ReadonlyArray<TakenSpan>
    } = {},
) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [
                [SELECT_PAGE_BY_SLUG, options.page === false ? [] : [PAGE]],
                [SELECT_BOOKING_BY_KEY, options.keyed ?? []],
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

describe("BookingPublicService", () => {
    describe("page", () => {
        it("shows the shop with its active services only", async () => {
            const { service } = await build()

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
        it("lists each free start of the day once", async () => {
            const { service, models } = await build()

            const { times } = await service.freeTimes({ slug: "spa-anna", service: "s1", date: "2026-10-12", party: 1 })

            expect(times[0]).toBe(MONDAY_NINE)
            expect(times).toHaveLength(9)
            expect(new Set(times).size).toBe(times.length)
            expect(models.spans).toHaveBeenCalledWith(
                WORKSPACE,
                Date.UTC(2026, 9, 11, 17),
                Date.UTC(2026, 9, 12, 17) + 86_400_000,
                "Asia/Ho_Chi_Minh",
            )
        })

        it("leaves out the starts a booking holds", async () => {
            const { service } = await build({ spans: [TAKEN_NINE] })

            const { times } = await service.freeTimes({ slug: "spa-anna", service: "s1", date: "2026-10-12", party: 1 })

            expect(times).not.toContain(MONDAY_NINE)
            expect(times).toHaveLength(8)
        })

        it("offers nothing for a service the page does not list", async () => {
            const { service, models } = await build()

            await expect(
                service.freeTimes({ slug: "spa-anna", service: "s2", date: "2026-10-12", party: 1 }),
            ).resolves.toEqual({ times: [] })
            await expect(
                service.freeTimes({ slug: "spa-anna", service: "nope", date: "2026-10-12", party: 1 }),
            ).resolves.toEqual({ times: [] })
            expect(models.spans).not.toHaveBeenCalled()
        })

        it("refuses an unknown slug", async () => {
            const { service } = await build({ page: false })

            await expect(
                service.freeTimes({ slug: "nobody", service: "s1", date: "2026-10-12", party: 1 }),
            ).rejects.toMatchObject({
                code: BookingsErrorCode.PageNotFound,
            })
        })
    })

    describe("book", () => {
        it("confirms a free time at once, plans the reminders and tells the page", async () => {
            const { service, reservation, reminders, tx } = await build()

            const result = await service.book(requestOf())

            expect(result).toEqual({
                ok: true,
                state: "confirmed",
                code: "confirmed",
                serviceName: "Cut",
                startIso: MONDAY_NINE,
                alternatives: [],
                bookingId: "b1",
            })
            expect(reservation.reserve).toHaveBeenCalledWith({
                manager: expect.anything(),
                force: false,
                booking: expect.objectContaining({
                    workspaceId: WORKSPACE,
                    customerName: "Mai",
                    customerPhone: "84912345678",
                    customerEmail: "mai@example.com",
                    serviceId: "s1",
                    resourceId: "r1",
                    startMs: Date.parse(MONDAY_NINE),
                    endMs: Date.parse(MONDAY_NINE) + HOUR,
                    status: "confirmed",
                    holdsSlot: true,
                    sourceChannel: "public_page",
                    note: "first visit",
                    conflictNote: "",
                    idempotencyKey: null,
                    depositStatus: "none",
                }),
            })
            expect(reminders.schedule).toHaveBeenCalledWith(
                expect.objectContaining({
                    workspaceId: WORKSPACE,
                    bookingId: "b1",
                    startMs: Date.parse(MONDAY_NINE),
                    nowMs: NOW,
                    defaultHours: [24, 2],
                }),
            )
            expect(tx.commits).toBe(1)
        })

        it("holds the time for the owner when the owner confirms by hand", async () => {
            const model = modelOf({
                settings: { ...DEFAULT_SETTINGS, slotStepMin: 60, autoConfirm: false, depositPct: 50 },
            })
            const { service, reservation, reminders } = await build({ model })

            const result = await service.book(requestOf({ token: "form-token-1", email: "nope" }))

            expect(result).toMatchObject({
                ok: true,
                state: "waiting",
                code: "received_free",
                bookingId: "b1",
                alternatives: [],
            })
            expect(reservation.reserve).toHaveBeenCalledWith(
                expect.objectContaining({
                    booking: expect.objectContaining({
                        status: "requested",
                        holdsSlot: true,
                        customerEmail: null,
                        depositVnd: 100000,
                        depositStatus: "due",
                        idempotencyKey: "public:form-token-1",
                    }),
                }),
            )
            expect(reminders.schedule).not.toHaveBeenCalled()
        })

        it("parks a request for a taken time without a hold and offers the nearest free times", async () => {
            const { service, reservation } = await build({ spans: [TAKEN_NINE] })

            const result = await service.book(requestOf())

            expect(result).toMatchObject({ ok: true, state: "waiting", code: "received_taken", bookingId: "b1" })
            expect(result.alternatives).toEqual([
                "2026-10-12T03:00:00.000Z",
                "2026-10-12T04:00:00.000Z",
                "2026-10-12T05:00:00.000Z",
            ])
            expect(reservation.reserve).toHaveBeenCalledTimes(1)
            expect(reservation.reserve).toHaveBeenCalledWith(
                expect.objectContaining({
                    booking: expect.objectContaining({
                        status: "requested",
                        holdsSlot: false,
                        resourceId: "r1",
                        conflictNote: "full",
                    }),
                }),
            )
        })

        it("parks the request when the time was free but another request took it first", async () => {
            const { service, reservation } = await build()
            reservation.reserve.mockResolvedValueOnce({ kind: "full" })

            const result = await service.book(requestOf())

            expect(result).toMatchObject({ state: "waiting", code: "received_taken", bookingId: "b1" })
            expect(reservation.reserve).toHaveBeenCalledTimes(2)
            expect(reservation.reserve).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    booking: expect.objectContaining({ holdsSlot: false, conflictNote: "full" }),
                }),
            )
        })

        it("records why a time outside the opening hours cannot be taken", async () => {
            const { service, reservation } = await build()

            await service.book(requestOf({ start: "2026-10-12T14:00:00.000Z" }))

            expect(reservation.reserve).toHaveBeenCalledWith(
                expect.objectContaining({
                    booking: expect.objectContaining({ holdsSlot: false, conflictNote: "closed" }),
                }),
            )
        })

        it("fails when there is no resource to park the request on", async () => {
            const { service } = await build({ model: modelOf({ resources: [] }) })

            await expect(service.book(requestOf())).resolves.toEqual({
                ok: false,
                state: "failed",
                code: "no_resource",
                serviceName: "Cut",
                startIso: MONDAY_NINE,
                alternatives: [],
                bookingId: null,
            })
        })

        it("fails when even the parked request cannot be written", async () => {
            const { service, reservation } = await build({ spans: [TAKEN_NINE] })
            reservation.reserve.mockResolvedValueOnce({ kind: "resource_not_found" })

            await expect(service.book(requestOf())).resolves.toMatchObject({
                ok: false,
                state: "failed",
                code: "no_resource",
            })
        })

        it("answers a repeated form from the booking it already made", async () => {
            const confirmed = await build({ keyed: [{ id: "b7", status: "confirmed", holds_slot: true }] })
            const held = await build({ keyed: [{ id: "b8", status: "requested", holds_slot: true }] })
            const parked = await build({ keyed: [{ id: "b9", status: "requested", holds_slot: false }] })
            const request = requestOf({ token: "form-token-1" })

            await expect(confirmed.service.book(request)).resolves.toMatchObject({
                state: "confirmed",
                code: "confirmed",
                bookingId: "b7",
            })
            await expect(held.service.book(request)).resolves.toMatchObject({
                state: "waiting",
                code: "received_free",
                bookingId: "b8",
            })
            await expect(parked.service.book(request)).resolves.toMatchObject({
                state: "waiting",
                code: "received_taken",
                bookingId: "b9",
            })
            expect(confirmed.reservation.reserve).not.toHaveBeenCalled()
        })

        it("drops a bot that filled the honeypot without writing anything", async () => {
            const { service, reservation, models } = await build()

            await expect(service.book(requestOf({ website: "http://spam" }))).resolves.toEqual({
                ok: true,
                state: "waiting",
                code: "received_free",
                serviceName: "",
                startIso: "",
                alternatives: [],
                bookingId: null,
            })
            expect(models.model).not.toHaveBeenCalled()
            expect(reservation.reserve).not.toHaveBeenCalled()
        })

        it("refuses a request with a missing or wrong field before any write", async () => {
            const { service, reservation } = await build()

            await expect(service.book(requestOf({ name: "  " }))).resolves.toMatchObject({
                ok: false,
                state: "invalid",
                code: "name_required",
            })
            await expect(service.book(requestOf({ phone: "12" }))).resolves.toMatchObject({
                state: "invalid",
                code: "phone_invalid",
            })
            await expect(service.book(requestOf({ phone: "" }))).resolves.toMatchObject({
                state: "invalid",
                code: "phone_invalid",
            })
            await expect(service.book(requestOf({ start: "tomorrow" }))).resolves.toMatchObject({
                state: "invalid",
                code: "start_invalid",
            })
            await expect(service.book(requestOf({ serviceId: "s2" }))).resolves.toMatchObject({
                state: "invalid",
                code: "service_unavailable",
            })
            await expect(service.book(requestOf({ serviceId: "zzz" }))).resolves.toMatchObject({
                state: "invalid",
                code: "service_unavailable",
            })
            expect(reservation.reserve).not.toHaveBeenCalled()
        })

        it("refuses an unknown slug", async () => {
            const { service } = await build({ page: false })

            await expect(service.book(requestOf())).rejects.toMatchObject({ code: BookingsErrorCode.PageNotFound })
        })
    })
})
