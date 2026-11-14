import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { entityPort, type EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort, type PortDefinition } from "@nivo-lite/agent-sdk/port"
import { bookingEntity } from "../../entities/booking/booking.entity"
import { bookingHoursEntity } from "../../entities/booking/hours.entity"
import { bookingResourceEntity } from "../../entities/booking/resource.entity"
import { bookingServiceEntity } from "../../entities/booking/service.entity"
import { bookingSettingsEntity } from "../../entities/booking/settings.entity"

/*
 * The data of the Booking module is the engine's generic record store: every row is a record of a declared type read and written
 * through its entity port. Only the list sources below are the module's own slots, the id every list read of a module has.
 */

/** A booking as the workbench lists it. */
export type BookingRow = {
    /** The booking id. */
    readonly id: string
    /** The name the customer booked under. */
    readonly customerName: string
    /** The phone the customer gave, or null. */
    readonly customerPhone: string | null
    /** The start (ISO 8601). */
    readonly startAt: string
    /** `requested`, `confirmed`, `cancelled` or `done`. */
    readonly status: string
    /** How many people come. */
    readonly partySize: number
    /** What the customer asked for beside the service. */
    readonly note: string
}

/** A service as the workbench lists it. */
export type ServiceRow = {
    /** The service id. */
    readonly id: string
    /** Its name. */
    readonly name: string
    /** How long a visit lasts, in minutes. */
    readonly durationMin: number
    /** Its price, in VND. */
    readonly priceVnd: number
    /** Whether it takes bookings. */
    readonly active: boolean
}

/** A resource as the workbench lists it. */
export type ResourceRow = {
    /** The resource id. */
    readonly id: string
    /** Its name. */
    readonly name: string
    /** `person` or `room`. */
    readonly kind: string
    /** How many customers it serves at once. */
    readonly capacity: number
    /** Whether it takes bookings. */
    readonly active: boolean
}

/** The port of the bookings (`blocks-core.booking.booking`). */
export const BOOKINGS: PortDefinition<EntityApi> = entityPort(bookingEntity)

/** The port of the services (`blocks-core.booking.service`). */
export const SERVICES: PortDefinition<EntityApi> = entityPort(bookingServiceEntity)

/** The port of the resources (`blocks-core.booking.resource`). */
export const RESOURCES: PortDefinition<EntityApi> = entityPort(bookingResourceEntity)

/** The port of the opening hours (`blocks-core.booking.hours`). */
export const HOURS: PortDefinition<EntityApi> = entityPort(bookingHoursEntity)

/** The port of the calendar rules (`blocks-core.booking.settings`, one record per workspace). */
export const SETTINGS: PortDefinition<EntityApi> = entityPort(bookingSettingsEntity)

/** The list source of the bookings. */
export const BOOKINGS_LIST: PortDefinition<ListSource<BookingRow>> = definePort<ListSource<BookingRow>>("booking.bookings-list")

/** The list source of the services. */
export const SERVICES_LIST: PortDefinition<ListSource<ServiceRow>> = definePort<ListSource<ServiceRow>>("booking.services-list")

/** The list source of the resources. */
export const RESOURCES_LIST: PortDefinition<ListSource<ResourceRow>> = definePort<ListSource<ResourceRow>>("booking.resources-list")
