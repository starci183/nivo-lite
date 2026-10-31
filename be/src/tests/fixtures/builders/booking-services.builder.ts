import { builder } from "@starci/jest-preset"
import { In } from "typeorm"
import { bookingServicesEntities } from "@modules/domain/booking-services"

const [BookingServiceEntity] = bookingServicesEntities
type BookingServiceEntity = InstanceType<typeof BookingServiceEntity>

/** A service row of the catalogue; the caller overrides what the case is about. */
export const serviceRowOf = builder<BookingServiceEntity>({
    id: "s-0",
    workspaceId: "ws-1",
    name: "Service",
    description: "",
    durationMin: 60,
    bufferMin: 0,
    priceVnd: null,
    resourceKind: null,
    followupDays: null,
    active: true,
    sortOrder: 0,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** The catalogue service `s-1`, named Cut. */
export const CUT_SERVICE = serviceRowOf({ id: "s-1", name: "Cut" })

/** The catalogue service `s-2`, named Dye. */
export const DYE_SERVICE = serviceRowOf({ id: "s-2", name: "Dye" })

/** A service that holds its resource 30 minutes plus a 5 minute buffer. */
export const TIMED_SERVICE = serviceRowOf({ durationMin: 30, bufferMin: 5 })

/** The options `catalogue("ws-1")` reads the services with: the owner's order, at most 200. */
export const CATALOGUE_FIND = {
    where: { workspaceId: "ws-1" },
    order: { sortOrder: "ASC", createdAt: "ASC" },
    take: 200,
}

/** The options `namesOf("ws-1", ids)` reads the names with: only id and name, bounded by the ids asked. */
export const namesFindOf = (ids: ReadonlyArray<string>) => ({
    select: ["id", "name"],
    where: { workspaceId: "ws-1", id: In([...ids]) },
    take: ids.length,
})

/** The options `timingOf("ws-1", "s-1")` reads the timing with: only the duration and the buffer. */
export const TIMING_FIND = { select: { durationMin: true, bufferMin: true }, where: { workspaceId: "ws-1", id: "s-1" } }
