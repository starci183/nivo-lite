import type { ListShape } from "@nivo-lite/agent-sdk/block"
import { listRead, type ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import { BOOKING_STATUSES } from "../rules/booking"
import { BOOKING_VIEW } from "../constants"
import {
    BOOKINGS_LIST,
    RESOURCES_LIST,
    SERVICES_LIST,
    type BookingRow,
    type ResourceRow,
    type ServiceRow,
} from "../ports"

/** The bookings: searched by the customer's name, narrowed by status, the next visit first (or the latest booked). */
export const BOOKINGS_SHAPE: ListShape = {
    search: { fields: ["customerName"] },
    filters: { status: { field: "status", op: "eq", of: BOOKING_STATUSES } },
    sort: { upcoming: [["startAt", "asc"]], latest: [["startAt", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "customerName", description: "note" },
}

/** `blocks-core.booking.api.booking.list`: the bookings of the calendar. */
export const BOOKINGS_READ: ListReadDefinition = listRead<BookingRow>({
    id: "blocks-core.booking.api.booking.list",
    dataKind: "booking",
    permission: BOOKING_VIEW,
    fields: ["id", "customerName", "customerPhone", "startAt", "status", "partySize", "note"],
    list: BOOKINGS_SHAPE,
    source: BOOKINGS_LIST,
})

/** The services: searched by name, in name order. */
export const SERVICES_SHAPE: ListShape = {
    search: { fields: ["name"] },
    sort: { name: [["name", "asc"]] },
    page: { size: 50 },
    row: { id: "id", title: "name" },
}

/** `blocks-core.booking.api.service.list`: the services customers book. */
export const SERVICES_READ: ListReadDefinition = listRead<ServiceRow>({
    id: "blocks-core.booking.api.service.list",
    dataKind: "booking-service",
    permission: BOOKING_VIEW,
    fields: ["id", "name", "durationMin", "priceVnd", "active"],
    list: SERVICES_SHAPE,
    source: SERVICES_LIST,
})

/** The resources: searched by name, in calendar order. */
export const RESOURCES_SHAPE: ListShape = {
    search: { fields: ["name"] },
    sort: { order: [["sort", "asc"]] },
    page: { size: 50 },
    row: { id: "id", title: "name" },
}

/** `blocks-core.booking.api.resource.list`: the people and rooms that serve bookings. */
export const RESOURCES_READ: ListReadDefinition = listRead<ResourceRow>({
    id: "blocks-core.booking.api.resource.list",
    dataKind: "booking-resource",
    permission: BOOKING_VIEW,
    fields: ["id", "name", "kind", "capacity", "active"],
    list: RESOURCES_SHAPE,
    source: RESOURCES_LIST,
})
