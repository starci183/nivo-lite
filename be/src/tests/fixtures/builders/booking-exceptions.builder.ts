import { builder } from "@starci/jest-preset"
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
