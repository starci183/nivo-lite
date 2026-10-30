import { builder } from "@starci/jest-preset"
import { MoreThanOrEqual } from "typeorm"
import { bookingExceptionsEntities } from "@modules/domain/booking-exceptions"

const [BookingExceptionEntity] = bookingExceptionsEntities

/** A calendar exception row of workspace `ws-1`: a closed day without a resource. */
export const bookingExceptionRowOf = builder<InstanceType<typeof BookingExceptionEntity>>({
    id: "e-0",
    workspaceId: "ws-1",
    resourceId: null,
    onDate: "2026-10-01",
    closed: true,
    startTime: null,
    endTime: null,
    note: "",
})

/** The options `list("ws-1")` reads the exceptions with: the whole workspace in date order, bounded. */
export const EXCEPTIONS_FIND_ALL = { where: { workspaceId: "ws-1" }, order: { onDate: "ASC", id: "ASC" }, take: 1000 }

/** The options `list("ws-1", from)` reads the exceptions with: from a local date on, in date order, bounded. */
export const exceptionsFindFrom = (from: string) => ({
    where: { workspaceId: "ws-1", onDate: MoreThanOrEqual(from) },
    order: { onDate: "ASC", id: "ASC" },
    take: 1000,
})
