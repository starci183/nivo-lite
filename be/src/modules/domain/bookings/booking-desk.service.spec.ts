import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { FakeTransaction } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import type { BookingServiceTiming } from "@modules/domain/booking-services"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { BookingDeskService } from "./booking-desk.service"
import { BookingModelService } from "./booking-model.service"
import { BookingRemindersService } from "@modules/domain/booking-reminders"
import { ADDED_BOOKING, DESK_OWNER, NOW, THURSDAY_NINE, WORKSPACE } from "@tests/fixtures/builders/booking-desk.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BookingReservationService } from "./booking-reservation.service"
import { DEFAULT_SETTINGS } from "./bookings.contracts"
import type { AddBookingParams, BookingModel, MoveBookingParams, TakenSpan } from "./bookings.contracts"
import { BookingsErrorCode } from "./errors/bookings.error"
import type { BookingStateRowFacts } from "./booking-facts.contracts"
import { BookingEntity } from "./persistence/entities"

const anything = (): unknown => expect.anything()

/** The locked read of a booking: its workspace-scoped lookup under a write lock on the booking row. */
const expectLocked = (lock: FakeQueryBuilder): void => {
    expect(lock.callsOf("where")).toEqual([
        ["b.workspaceId = :workspaceId AND b.id = :id", { workspaceId: WORKSPACE, id: "b1" }],
    ])
    expect(lock.callsOf("setLock")).toEqual([["pessimistic_write", undefined, ["b"]]])
}

/** The fields one status write sets, with the criteria it matches. */
const expectUpdated = (tx: FakeTransaction, fields: object, nth = 1): void => {
    expect(tx.em.update).toHaveBeenNthCalledWith(
        nth,
        BookingEntity,
        { workspaceId: WORKSPACE, id: "b1" },
        expect.objectContaining(fields),
    )
}

/** The reminder schedule a booking starting at `startMs` is planned with. */
const scheduleOf = (startMs: number) => ({
    manager: anything(),
    workspaceId: WORKSPACE,
    bookingId: "b1",
    startMs,
    nowMs: NOW,
    defaultHours: [24, 2],
})

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const USER = "user-1"
const REF = { workspaceId: WORKSPACE, id: "b1" }
const HOUR = 3_600_000

const modelOf = builder<BookingModel>({
    settings: { ...DEFAULT_SETTINGS, slotStepMin: 60, noShowFeeVnd: 0 },
    services: [
        {
            id: "s1",
            name: "Cut",
            description: "",
            durationMin: 60,
            bufferMin: 30,
            priceVnd: 200000,
            resourceKind: null,
            active: true,
        },
    ],
    resources: [{ id: "r1", name: "Anna", kind: "staff", capacity: 1, active: true, sort: 0 }],
    hours: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ resourceId: "r1", weekday, start: "09:00", end: "12:00" })),
    exceptions: [],
})
const addOf = builder<AddBookingParams>({
    workspaceId: WORKSPACE,
    serviceId: "s1",
    resourceId: "",
    date: "2026-10-15",
    time: "09:00",
    party: 1,
    name: " Mai ",
    phone: "0912 345 678",
    note: " walk-in ",
    force: false,
})
const moveOf = builder<MoveBookingParams>({
    workspaceId: WORKSPACE,
    id: "b1",
    startAt: "2026-10-15T03:00:00.000Z",
    resourceId: "r2",
    force: false,
})
const BOOKING: BookingStateRowFacts = {
    id: "b1",
    resource_id: "r1",
    party_size: 2,
    status: "confirmed",
    service_id: "s1",
    start_ms: THURSDAY_NINE,
}
const TIMING: BookingServiceTiming = { durationMin: 60, bufferMin: 15 }
const taken = (resourceId: string): TakenSpan => ({
    id: "b9",
    resourceId,
    startMs: THURSDAY_NINE,
    blockEndMs: THURSDAY_NINE + HOUR,
    partySize: 1,
})

const build = async (
    model: BookingModel = modelOf(),
    spans: ReadonlyArray<TakenSpan> = [],
    row?: BookingStateRowFacts,
    timing: BookingServiceTiming | null = TIMING,
) => {
    const tx = fakeTransaction(mockEntityManager({ update: [BookingEntity, {}] }))
    const lock = fakeQueryBuilder({ getRawOne: row })
    const finish = fakeQueryBuilder({ execute: {} })
    tx.em.createQueryBuilder.mockReturnValueOnce(lock.builder).mockReturnValueOnce(finish.builder)
    const access = mock<WorkspaceMembersService>()
    access.require.mockResolvedValue(DESK_OWNER)
    const models = mock<BookingModelService>()
    models.model.mockResolvedValue(model)
    models.settings.mockResolvedValue(model.settings)
    models.spans.mockResolvedValue(spans)
    const reservation = mock<BookingReservationService>()
    reservation.reserve.mockResolvedValue({ kind: "reserved", id: "b-new" })
    reservation.relocate.mockResolvedValue("moved")
    const reminders = mock<BookingRemindersService>()
    reminders.schedule.mockResolvedValue([])
    reminders.cancel.mockResolvedValue(undefined)
    const servicesRead = mock<BookingServicesReadService>({ timingOf: jest.fn(() => Promise.resolve(timing)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BookingDeskService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: access },
            { provide: BookingModelService, useValue: models },
            { provide: BookingReservationService, useValue: reservation },
            { provide: BookingRemindersService, useValue: reminders },
            { provide: BookingServicesReadService, useValue: servicesRead },
        ],
    }).compile()
    return { service: moduleRef.get(BookingDeskService), access, models, reservation, reminders, tx, lock, finish }
}

const buildLocked = (status: BookingStateRowFacts["status"] = "confirmed", model: BookingModel = modelOf()) =>
    build(model, [], { ...BOOKING, status })

describe("BookingDeskService", () => {
    describe("add", () => {
        it("picks a free resource and writes a confirmed booking with its reminders", async () => {
            const { service, access, reservation, reminders } = await build()

            await expect(service.add(USER, addOf())).resolves.toEqual({ ok: true, reason: null, id: "b-new" })

            expect(access.require).toHaveBeenCalledWith(USER, WORKSPACE, ["owner", "manager"])
            expect(reservation.reserve).toHaveBeenCalledWith({
                manager: anything(),
                force: false,
                booking: ADDED_BOOKING,
            })
            expect(reminders.schedule).toHaveBeenCalledWith(
                expect.objectContaining({
                    bookingId: "b-new",
                    startMs: THURSDAY_NINE,
                    nowMs: NOW,
                    defaultHours: [24, 2],
                }),
            )
        })

        it("charges the deposit of the policy", async () => {
            const model = modelOf({ settings: { ...DEFAULT_SETTINGS, depositPct: 25 } })
            const { service, reservation } = await build(model)

            await service.add(USER, addOf())

            expect(reservation.reserve).toHaveBeenCalledWith(
                expect.objectContaining({
                    booking: objectLike({ depositVnd: 50000, depositStatus: "due" }),
                }),
            )
        })

        it("uses the resource the owner chose without asking the planner", async () => {
            const { service, reservation } = await build(modelOf(), [taken("r1")])

            await expect(service.add(USER, addOf({ resourceId: "r1" }))).resolves.toMatchObject({ ok: true })

            expect(reservation.reserve).toHaveBeenCalledWith(objectLike({ booking: objectLike({ resourceId: "r1" }) }))
        })
    })
})

describe("BookingDeskService", () => {
    describe("add", () => {
        it("refuses a start the planner cannot place and says why", async () => {
            const full = await build(modelOf(), [taken("r1")])
            const closed = await build()
            const past = await build()

            await expect(full.service.add(USER, addOf())).resolves.toEqual({ ok: false, reason: "full", id: null })
            await expect(closed.service.add(USER, addOf({ time: "20:00" }))).resolves.toEqual({
                ok: false,
                reason: "closed",
                id: null,
            })
            await expect(past.service.add(USER, addOf({ date: "2026-10-13" }))).resolves.toEqual({
                ok: false,
                reason: "datetime_invalid",
                id: null,
            })
            expect(full.reservation.reserve).not.toHaveBeenCalled()
        })

        it("forces the first fitting resource when the owner insists on a taken time", async () => {
            const { service, reservation } = await build(modelOf(), [taken("r1")])

            await expect(service.add(USER, addOf({ force: true }))).resolves.toMatchObject({ ok: true })

            expect(reservation.reserve).toHaveBeenCalledWith(
                objectLike({ force: true, booking: objectLike({ resourceId: "r1" }) }),
            )
        })

        it("refuses when no resource exists to force onto", async () => {
            const { service } = await build(modelOf({ resources: [] }))

            await expect(service.add(USER, addOf({ force: true }))).resolves.toEqual({
                ok: false,
                reason: "no_resource",
                id: null,
            })
        })

        it("refuses a taken place, or a resource that is not in the workspace", async () => {
            const taken_ = await build()
            taken_.reservation.reserve.mockResolvedValueOnce({ kind: "full" })
            const missing = await build()
            missing.reservation.reserve.mockResolvedValueOnce({ kind: "resource_not_found" })

            await expect(taken_.service.add(USER, addOf())).resolves.toEqual({ ok: false, reason: "taken", id: null })
            await expect(missing.service.add(USER, addOf({ resourceId: "r9" }))).resolves.toEqual({
                ok: false,
                reason: "resource_not_found",
                id: null,
            })
            expect(taken_.reminders.schedule).not.toHaveBeenCalled()
        })
    })
})

describe("BookingDeskService", () => {
    describe("add", () => {
        it("refuses an incomplete form before touching the calendar", async () => {
            const { service, models } = await build()

            await expect(service.add(USER, addOf({ serviceId: "" }))).resolves.toMatchObject({
                reason: "service_required",
            })
            await expect(service.add(USER, addOf({ name: "  " }))).resolves.toMatchObject({ reason: "name_required" })
            await expect(service.add(USER, addOf({ date: "12/10", time: "9" }))).resolves.toMatchObject({
                reason: "datetime_invalid",
            })
            await expect(service.add(USER, addOf({ serviceId: "zzz" }))).resolves.toMatchObject({
                reason: "service_not_found",
            })
            expect(models.spans).not.toHaveBeenCalled()
        })
    })
})

describe("BookingDeskService", () => {
    describe("move", () => {
        it("requires owner or manager access before moving the booking", async () => {
            const { service, access, reservation } = await buildLocked()
            await expect(service.move(USER, moveOf())).resolves.toEqual({ ok: true, reason: null, id: "b1" })
            expect(access.require).toHaveBeenCalledWith(USER, WORKSPACE, ["owner", "manager"])
            expect(reservation.relocate).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "r2" }))
        })
    })

    describe("moveApproved", () => {
        it.each([
            { status: "requested", resourceId: "", chosen: "r1", force: true },
            { status: "rescheduled", resourceId: "r2", chosen: "r2", force: false },
        ] as const)("moves a $status booking to resource '$resourceId' and replans reminders", async (params) => {
            const { service, access, models, reservation, reminders, tx, lock } = await buildLocked(params.status)
            await expect(service.moveApproved(moveOf(params))).resolves.toEqual({ ok: true, reason: null, id: "b1" })
            const startMs = Date.parse("2026-10-15T03:00:00.000Z")
            expect(access.require).not.toHaveBeenCalled()
            expect(models.settings).toHaveBeenCalledWith(WORKSPACE)
            expectLocked(lock)
            expect(reservation.relocate).toHaveBeenCalledWith({
                manager: anything(),
                workspaceId: WORKSPACE,
                bookingId: "b1",
                resourceId: params.chosen,
                partySize: 2,
                startMs,
                endMs: startMs + HOUR,
                blockEndMs: startMs + HOUR + HOUR / 4,
                nowMs: NOW,
                force: params.force,
            })
            expect(reminders.schedule).toHaveBeenCalledWith(scheduleOf(startMs))
            expect(tx.commits).toBe(1)
        })

        it.each<"taken" | "resource_not_found">(["taken", "resource_not_found"])(
            "answers %s without replanning reminders",
            async (reason) => {
                const { service, reservation, reminders, lock } = await buildLocked()
                reservation.relocate.mockResolvedValueOnce(reason)
                await expect(service.moveApproved(moveOf())).resolves.toEqual({ ok: false, reason, id: null })
                expectLocked(lock)
                expect(reservation.relocate).toHaveBeenCalledTimes(1)
                expect(reminders.schedule).not.toHaveBeenCalled()
            },
        )

        it.each(["done", "cancelled", "no_show"] as const)("leaves a %s booking in place", async (status) => {
            const { service, reservation, reminders, tx, lock } = await buildLocked(status)
            await expect(service.moveApproved(moveOf())).resolves.toEqual({
                ok: false,
                reason: "not_movable",
                id: null,
            })
            expectLocked(lock)
            expect(tx.em.update).not.toHaveBeenCalled()
            expect(reservation.relocate).not.toHaveBeenCalled()
            expect(reminders.schedule).not.toHaveBeenCalled()
        })
    })
})

describe("BookingDeskService", () => {
    describe("confirm", () => {
        it("requires owner or manager access before confirming the request", async () => {
            const { service, access, tx } = await buildLocked("requested")
            await expect(service.confirm(USER, REF)).resolves.toEqual({ status: "confirmed", feeDue: false })
            expect(access.require).toHaveBeenCalledWith(USER, WORKSPACE, ["owner", "manager"])
            expectUpdated(tx, { status: "confirmed", holdsSlot: true, conflictNote: "" })
        })
    })

    describe("confirmApproved", () => {
        it("confirms the approved request with reminders and skips membership checks", async () => {
            const { service, access, models, reminders, tx, lock } = await buildLocked("requested")
            await expect(service.confirmApproved(REF)).resolves.toEqual({ status: "confirmed", feeDue: false })
            expect(access.require).not.toHaveBeenCalled()
            expect(models.settings).toHaveBeenCalledWith(WORKSPACE)
            expectLocked(lock)
            expectUpdated(tx, { status: "confirmed" })
            expect(reminders.schedule).toHaveBeenCalledWith(scheduleOf(THURSDAY_NINE))
            expect(tx.commits).toBe(1)
        })

        it.each(["confirmed", "rescheduled", "cancelled", "done", "no_show"] as const)(
            "leaves an approved %s booking unchanged",
            async (status) => {
                const { service, access, reminders, tx, lock } = await buildLocked(status)
                await expect(service.confirmApproved(REF)).resolves.toEqual({ status, feeDue: false })
                expect(access.require).not.toHaveBeenCalled()
                expectLocked(lock)
                expect(tx.em.update).not.toHaveBeenCalled()
                expect(reminders.schedule).not.toHaveBeenCalled()
            },
        )
    })

    describe("checkIn", () => {
        it("records the arrival of the customer", async () => {
            const { service, tx } = await buildLocked("confirmed")
            await expect(service.checkIn(USER, REF)).resolves.toEqual({ status: "confirmed", feeDue: false })
            expectUpdated(tx, { checkedInAt: new Date(NOW), status: "confirmed" })
        })
    })

    describe("done", () => {
        it("finishes the booking and stops its reminders", async () => {
            const { service, reminders, finish } = await buildLocked("confirmed")
            await expect(service.done(USER, REF)).resolves.toEqual({ status: "done", feeDue: false })
            expect(evaluatedValues(finish.callsOf("set")[0]?.[0])).toEqual({
                status: "done",
                doneAt: new Date(NOW),
                checkedInAt: "COALESCE(checked_in_at, :now)",
            })
            expect(finish.callsOf("where")).toEqual([[{ workspaceId: WORKSPACE, id: "b1" }]])
            expect(finish.callsOf("setParameter")).toEqual([["now", new Date(NOW)]])
            expect(reminders.cancel).toHaveBeenCalledWith(anything(), "b1", "booking_done")
        })
    })

    describe("noShow", () => {
        it.each([
            { fee: 0, feeDue: false },
            { fee: 50000, feeDue: true },
        ])("records the no-show with a policy fee of $fee", async ({ fee, feeDue }) => {
            const model = modelOf({ settings: { ...DEFAULT_SETTINGS, noShowFeeVnd: fee } })
            const { service, reminders, tx } = await buildLocked("confirmed", model)
            await expect(service.noShow(USER, REF)).resolves.toEqual({ status: "no_show", feeDue })
            expectUpdated(tx, { status: "no_show" })
            expect(reminders.cancel).toHaveBeenCalledWith(anything(), "b1", "no_show")
        })
    })
})

describe("BookingDeskService", () => {
    describe("cancel", () => {
        it("cancels the booking, frees its place and stops its reminders", async () => {
            const { service, reminders, tx } = await buildLocked("confirmed")
            await expect(service.cancel(USER, REF)).resolves.toEqual({ status: "cancelled", feeDue: false })
            expectUpdated(tx, {
                status: "cancelled",
                holdsSlot: false,
                cancelledAt: new Date(NOW),
                cancelReason: "owner_cancelled",
            })
            expect(reminders.cancel).toHaveBeenCalledWith(anything(), "b1", "owner_cancelled")
        })

        it("refuses a booking that is already closed", async () => {
            const { service, reminders } = await buildLocked("no_show")
            await expect(service.cancel(USER, REF)).rejects.toMatchObject({ code: BookingsErrorCode.NotChangeable })
            expect(reminders.cancel).not.toHaveBeenCalled()
        })

        it("refuses a booking the workspace does not have", async () => {
            const { service } = await build()
            await expect(service.cancel(USER, REF)).rejects.toMatchObject({ code: BookingsErrorCode.NotFound })
        })

        it("refuses a booking whose service is gone", async () => {
            const { service } = await build(modelOf(), [], BOOKING, null)
            await expect(service.cancel(USER, REF)).rejects.toMatchObject({ code: BookingsErrorCode.NotFound })
        })
    })

    describe("cancelApproved", () => {
        it.each(["requested", "confirmed", "rescheduled"] as const)(
            "cancels the approved %s booking with the supplied reason",
            async (status) => {
                const { service, access, reminders, tx, lock } = await buildLocked(status)
                await expect(service.cancelApproved(REF, "late_customer_cancel")).resolves.toEqual({
                    status: "cancelled",
                    feeDue: false,
                })
                expect(access.require).not.toHaveBeenCalled()
                expectLocked(lock)
                expectUpdated(tx, { status: "cancelled", cancelReason: "late_customer_cancel" })
                expect(reminders.cancel).toHaveBeenCalledWith(anything(), "b1", "customer_cancelled")
                expect(tx.commits).toBe(1)
            },
        )

        it.each(["cancelled", "done", "no_show"] as const)("keeps the approved %s booking closed", async (status) => {
            const { service, access, reminders, tx, lock } = await buildLocked(status)
            await expect(service.cancelApproved(REF, "customer_cancel")).resolves.toEqual({ status, feeDue: false })
            expect(access.require).not.toHaveBeenCalled()
            expectLocked(lock)
            expect(tx.em.update).not.toHaveBeenCalled()
            expect(reminders.cancel).not.toHaveBeenCalled()
        })
    })
})

describe("BookingDeskService", () => {
    it.each<"moveApproved" | "confirmApproved" | "cancelApproved">([
        "moveApproved",
        "confirmApproved",
        "cancelApproved",
    ])("rolls back %s when the approved booking is missing", async (method) => {
        const { service, reservation, reminders, tx, lock } = await build()
        await expect(service[method](moveOf(), "customer_cancel")).rejects.toMatchObject({
            code: BookingsErrorCode.NotFound,
        })
        expectLocked(lock)
        expect(tx.rollbacks).toBe(1)
        expect(reservation.relocate).not.toHaveBeenCalled()
        expect(reminders.schedule).not.toHaveBeenCalled()
        expect(reminders.cancel).not.toHaveBeenCalled()
    })
})
