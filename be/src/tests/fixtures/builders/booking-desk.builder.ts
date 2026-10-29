import type { FakeTransaction } from "@starci/jest-preset"
import { bookingsEntities } from "@modules/domain/bookings"
import type { FakeQueryBuilder } from "./entity-query-builder-fake.builder"

const [BookingEntity] = bookingsEntities

const anything = (): unknown => expect.anything()

/** The workspace the desk specs run in. */
export const WORKSPACE = "ws-1"

/** Wednesday 12:00 in Ho Chi Minh City. */
export const NOW = Date.UTC(2026, 9, 14, 5, 0)

/** The locked read of a booking: its workspace-scoped lookup under a write lock on the booking row. */
export const expectLocked = (lock: FakeQueryBuilder): void => {
    expect(lock.callsOf("where")).toEqual([
        ["b.workspaceId = :workspaceId AND b.id = :id", { workspaceId: WORKSPACE, id: "b1" }],
    ])
    expect(lock.callsOf("setLock")).toEqual([["pessimistic_write", undefined, ["b"]]])
}

/** The fields one status write sets, with the criteria it matches. */
export const expectUpdated = (tx: FakeTransaction, fields: object, nth = 1): void => {
    expect(tx.em.update).toHaveBeenNthCalledWith(
        nth,
        BookingEntity,
        { workspaceId: WORKSPACE, id: "b1" },
        expect.objectContaining(fields),
    )
}

/** The reminder schedule a booking starting at `startMs` is planned with. */
export const scheduleOf = (startMs: number) => ({
    manager: anything(),
    workspaceId: WORKSPACE,
    bookingId: "b1",
    startMs,
    nowMs: NOW,
    defaultHours: [24, 2],
})
