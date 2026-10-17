import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import { BookingReservationService } from "./booking-reservation.service"
import type { NewBooking, RelocateParams } from "./booking-reservation.service"
import { BookingsErrorCode } from "./errors/bookings.error"
import { INSERT_BOOKING, LOCK_RESOURCE, RELOCATE_BOOKING, SELECT_RESOURCE_SPANS } from "./persistence/booking-write.sql"

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
const SPAN = { id: "b9", resource_id: "r1", party_size: 1, start_ms: START, block_end_ms: START + HOUR }

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [BookingReservationService] }).compile()
    return moduleRef.get(BookingReservationService)
}

describe("BookingReservationService", () => {
    describe("reserve", () => {
        it("locks the resource, checks the load and writes the booking", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ capacity: 1 }]],
                    [SELECT_RESOURCE_SPANS, []],
                    [INSERT_BOOKING, [{ id: "b1" }]],
                ],
            })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).resolves.toEqual({
                kind: "reserved",
                id: "b1",
            })

            expect(manager.query).toHaveBeenCalledWith(LOCK_RESOURCE, ["r1", "ws-1"])
            expect(manager.query).toHaveBeenCalledWith(SELECT_RESOURCE_SPANS, [
                "r1",
                new Date(START).toISOString(),
                new Date(START + HOUR).toISOString(),
                null,
            ])
            expect(manager.query).toHaveBeenCalledWith(
                INSERT_BOOKING,
                expect.arrayContaining(["ws-1", "Mai", "84912345678", "s1", "r1", 1, "confirmed", true, "public_page"]),
            )
        })

        it("answers full without writing when the resource has no room", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ capacity: 1 }]],
                    [SELECT_RESOURCE_SPANS, [SPAN]],
                ],
            })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).resolves.toEqual({
                kind: "full",
            })
        })

        it("writes over a taken place when forced and skips the load check", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ capacity: 1 }]],
                    [INSERT_BOOKING, [{ id: "b2" }]],
                ],
            })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: true })).resolves.toEqual({
                kind: "reserved",
                id: "b2",
            })
        })
    })
})

describe("BookingReservationService", () => {
    describe("reserve", () => {
        it("writes a request that does not hold its slot without checking the load", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ capacity: 1 }]],
                    [INSERT_BOOKING, [{ id: "b3" }]],
                ],
            })
            const reservation = await build()

            await expect(
                reservation.reserve({
                    manager,
                    booking: bookingOf({ holdsSlot: false, status: "requested" }),
                    force: false,
                }),
            ).resolves.toEqual({ kind: "reserved", id: "b3" })
        })

        it("answers resource_not_found when the resource is not in the workspace", async () => {
            const manager = mockEntityManager({ query: [LOCK_RESOURCE, []] })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).resolves.toEqual({
                kind: "resource_not_found",
            })
        })

        it("fails when the insert answers no row", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ capacity: 1 }]],
                    [SELECT_RESOURCE_SPANS, []],
                    [INSERT_BOOKING, []],
                ],
            })
            const reservation = await build()

            await expect(reservation.reserve({ manager, booking: bookingOf(), force: false })).rejects.toMatchObject({
                code: BookingsErrorCode.NotCreated,
            })
        })
    })
})

describe("BookingReservationService", () => {
    describe("relocate", () => {
        const moveOf = (overrides: Partial<RelocateParams> = {}): RelocateParams => ({
            manager: mockEntityManager(),
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
            const manager = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ capacity: 1 }]],
                    [SELECT_RESOURCE_SPANS, []],
                    [RELOCATE_BOOKING, []],
                ],
            })
            const reservation = await build()

            await expect(reservation.relocate(moveOf({ manager }))).resolves.toBe("moved")

            expect(manager.query).toHaveBeenCalledWith(RELOCATE_BOOKING, [
                "ws-1",
                "b1",
                "r2",
                new Date(START).toISOString(),
                new Date(START + HOUR).toISOString(),
                new Date(START + HOUR).toISOString(),
                new Date(START - HOUR).toISOString(),
            ])
        })

        it("answers taken when the new place is full and the move is not forced", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ capacity: 1 }]],
                    [SELECT_RESOURCE_SPANS, [{ ...SPAN, resource_id: "r2" }]],
                ],
            })
            const reservation = await build()

            await expect(reservation.relocate(moveOf({ manager }))).resolves.toBe("taken")
        })

        it("moves over a taken place when forced", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_RESOURCE, [{ capacity: 1 }]],
                    [RELOCATE_BOOKING, []],
                ],
            })
            const reservation = await build()

            await expect(reservation.relocate(moveOf({ manager, force: true }))).resolves.toBe("moved")
        })

        it("answers resource_not_found for a resource outside the workspace", async () => {
            const manager = mockEntityManager({ query: [LOCK_RESOURCE, []] })
            const reservation = await build()

            await expect(reservation.relocate(moveOf({ manager }))).resolves.toBe("resource_not_found")
        })
    })
})
