import { BookingResourceEntity } from "./booking-resource.entity"

export { BookingResourceEntity }

/** Every entity the booking-resources capability owns, collected by the database connection. */
export const bookingResourcesEntities = [BookingResourceEntity] as const
