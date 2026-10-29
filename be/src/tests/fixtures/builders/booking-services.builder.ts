import { builder } from "@starci/jest-preset"
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
})
