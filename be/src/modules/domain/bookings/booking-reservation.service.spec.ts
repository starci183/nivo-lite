import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { BookingResourceEntity } from "@modules/domain/booking-resources"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BookingReservationService } from "./booking-reservation.service"
import type { NewBooking, RelocateParams } from "./booking-reservation.service"
import { BookingsErrorCode } from "./errors/bookings.error"
import { BookingEntity } from "./persistence/entities"

const START = Date.UTC(2026, 9, 12, 2)
const HOUR = 3_600_000
const bookingOf = builder<NewBooking>({
    workspaceId: "ws-1",
    customerName: "Mai",
    customerPhone: "84912345678",
    customerEmail: null,
    serviceId: "s1",
    resourceId: "r1",
    startMs: START,
    endMs: START + HOUR,
    blockEndMs: START + HOUR,
    partySize: 1,
    status: "confirmed",
    holdsSlot: true,
    sourceChannel: "public_page",
    priceVnd: 200000,
    depositVnd: 0,
    depositStatus: "none",
    note: "",
    conflictNote: "",
    idempotencyKey: null,
})
const spanOf = (overrides: Partial<BookingEntity> = {}): BookingEntity =>
    Object.assign(new BookingEntity(), {
        id: "b9",
        resourceId: "r1",
        partySize: 1,
        startAt: new Date(START),
        blockEndAt: new Date(START + HOUR),
        ...overrides,
    })
const resourceOf = (capacity: number | null): BookingResourceEntity | null =>
    capacity === null ? null : Object.assign(new BookingResourceEntity(), { capacity })

/** A manager that locks a resource of `capacity` (none for null), lists `spans` and writes through a fake builder. */
const managerOf = (
    capacity: number | null,
    spans: Array<BookingEntity> | null,
    answers: { execute?: unknown } = {},
) => {
    const manager: MockEntityManager = mockEntityManager({
        findOne: [BookingResourceEntity, resourceOf(capacity)],
        find: [BookingEntity, spans ?? []],
    })
    const write = fakeQueryBuilder(answers)
    manager.createQueryBuilder.mockReturnValue(write.builder)
    return { manager, write }
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [BookingReservationService] }).compile()
    return moduleRef.get(BookingReservationService)
}

describe("BookingReservationService", () => {
    describe("reserve", () => {
        it("locks the resource, checks the load and writes the booking", async () => {
            const { manager, write } = managerOf(1, [], { execute: { raw: [{ id: "b1" }] } })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).resolves.toEqual({
                kind: "reserved",
                id: "b1",
            })

            expect(manager.findOne).toHaveBeenCalledWith(
                BookingResourceEntity,
                expect.objectContaining({
                    where: { id: "r1", workspaceId: "ws-1" },
                    lock: { mode: "pessimistic_write" },
                }),
            )
            const [, options] = manager.find.mock.calls[0] ?? []
            expect(JSON.stringify(options)).toContain(new Date(START).toISOString())
            expect(JSON.stringify(options)).toContain(new Date(START + HOUR).toISOString())
            expect(manager.createQueryBuilder).toHaveBeenCalledWith(BookingEntity, "bo")
            expect(write.callsOf("values")).toEqual([
                [
                    expect.objectContaining({
                        workspaceId: "ws-1",
                        customerName: "Mai",
                        customerPhone: "84912345678",
                        serviceId: "s1",
                        resourceId: "r1",
                        partySize: 1,
                        status: "confirmed",
                        holdsSlot: true,
                        sourceChannel: "public_page",
                        startAt: new Date(START),
                        priceVnd: "200000",
                        depositVnd: "0",
                    }),
                ],
            ])
            expect(write.callsOf("returning")).toEqual([["id"]])
        })

        it("answers full without writing when the resource has no room", async () => {
            const { manager, write } = managerOf(1, [spanOf()])
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).resolves.toEqual({
                kind: "full",
            })
            expect(write.calls).toEqual([])
        })

        it("writes over a taken place when forced and skips the load check", async () => {
            const { manager } = managerOf(1, null, { execute: { raw: [{ id: "b2" }] } })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: true })).resolves.toEqual({
                kind: "reserved",
                id: "b2",
            })
            expect(manager.find).not.toHaveBeenCalled()
        })
    })
})

describe("BookingReservationService", () => {
    describe("reserve", () => {
        it("writes a request that does not hold its slot without checking the load", async () => {
            const { manager } = managerOf(1, null, { execute: { raw: [{ id: "b3" }] } })
            const reservation = await build()

            await expect(
                reservation.reserve({
                    manager,
                    booking: bookingOf({ holdsSlot: false, status: "requested" }),
                    force: false,
                }),
            ).resolves.toEqual({ kind: "reserved", id: "b3" })
            expect(manager.find).not.toHaveBeenCalled()
        })

        it("writes a booking without a price as a null price", async () => {
            const { manager, write } = managerOf(1, [], { execute: { raw: [{ id: "b4" }] } })
            const reservation = await build()

            await reservation.reserve({ manager, booking: bookingOf({ priceVnd: null }), force: false })

            expect(write.callsOf("values")).toEqual([[expect.objectContaining({ priceVnd: null })]])
        })

        it("answers resource_not_found when the resource is not in the workspace", async () => {
            const { manager, write } = managerOf(null, null)
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).resolves.toEqual({
                kind: "resource_not_found",
            })
            expect(write.calls).toEqual([])
        })

        it("fails when the insert answers no rows at all", async () => {
            const { manager } = managerOf(1, [], { execute: {} })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).rejects.toMatchObject({
                code: BookingsErrorCode.NotCreated,
            })
        })

        it("fails when the insert answers no row", async () => {
            const { manager } = managerOf(1, [], { execute: { raw: [] } })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).rejects.toMatchObject({
                code: BookingsErrorCode.NotCreated,
            })
        })
    })
})

describe("BookingReservationService", () => {
    describe("relocate", () => {
        const moveOf = (manager: MockEntityManager, overrides: Partial<RelocateParams> = {}): RelocateParams => ({
            manager,
            workspaceId: "ws-1",
            bookingId: "b1",
            resourceId: "r2",
            partySize: 1,
            startMs: START,
            endMs: START + HOUR,
            blockEndMs: START + HOUR,
            nowMs: START - HOUR,
            force: false,
            ...overrides,
        })

        it("moves the booking when the new place has room", async () => {
            const { manager, write } = managerOf(1, [], { execute: { raw: [] } })
            const reservation = await build()

            await expect(reservation.relocate(moveOf(manager))).resolves.toBe("moved")

            const [, options] = manager.find.mock.calls[0] ?? []
            expect(JSON.stringify(options)).toContain("r2")
            expect(manager.createQueryBuilder).toHaveBeenCalledWith(BookingEntity, "bo")
            const moved = "CAST(:startAt AS timestamptz) <> start_at"
            expect(evaluatedValues(write.callsOf("set")[0]?.[0])).toEqual({
                resourceId: "r2",
                startAt: new Date(START),
                endAt: new Date(START + HOUR),
                blockEndAt: new Date(START + HOUR),
                holdsSlot: true,
                rescheduledFrom: `CASE WHEN ${moved} THEN start_at ELSE rescheduled_from END`,
                rescheduleCount: `reschedule_count + CASE WHEN ${moved} THEN 1 ELSE 0 END`,
                status: `CASE WHEN ${moved} AND status IN ('confirmed', 'rescheduled') THEN 'rescheduled' ELSE status END`,
                conflictNote: "",
                updatedAt: new Date(START - HOUR),
            })
            expect(write.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "b1" }]])
            expect(write.callsOf("setParameter")).toEqual([["startAt", new Date(START)]])
        })

        it("answers taken when the new place is full and the move is not forced", async () => {
            const { manager, write } = managerOf(1, [spanOf({ resourceId: "r2" })])
            const reservation = await build()

            await expect(reservation.relocate(moveOf(manager))).resolves.toBe("taken")
            expect(write.calls).toEqual([])
        })

        it("moves over a taken place when forced", async () => {
            const { manager } = managerOf(1, null, { execute: { raw: [] } })
            const reservation = await build()

            await expect(reservation.relocate(moveOf(manager, { force: true }))).resolves.toBe("moved")
            expect(manager.find).not.toHaveBeenCalled()
        })

        it("answers resource_not_found for a resource outside the workspace", async () => {
            const { manager } = managerOf(null, null)
            const reservation = await build()

            await expect(reservation.relocate(moveOf(manager))).resolves.toBe("resource_not_found")
        })
    })
})
