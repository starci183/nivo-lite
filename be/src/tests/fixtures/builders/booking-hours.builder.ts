import { builder } from "@starci/jest-preset"
import { bookingHoursEntities } from "@modules/domain/booking-hours"

const [BookingHourEntity] = bookingHoursEntities

/** A weekly opening window row of workspace `ws-1`: Sunday of resource `r-0`, 08:00 to 17:00. */
export const bookingHourRowOf = builder<InstanceType<typeof BookingHourEntity>>({
    id: "h-1",
    workspaceId: "ws-1",
    resourceId: "r-0",
    weekday: 0,
    startTime: "08:00",
    endTime: "17:00",
})

/** The filter that picks every opening window of resource `r-1` in workspace `ws-1`. */
export const RESOURCE_R1_HOURS_WHERE = { workspaceId: "ws-1", resourceId: "r-1" }
