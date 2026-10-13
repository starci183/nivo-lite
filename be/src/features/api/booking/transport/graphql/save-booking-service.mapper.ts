import type { SaveBookingServiceResult } from "../../application/save-booking-service.contracts"
import type { SaveBookingServiceType } from "./dto/save-booking-service.type"

export { toSaveBookingServiceRequest } from "@modules/domain/bookings"

/** Maps the saved identity to the GraphQL result. */
export const toSaveBookingServiceType = (result: SaveBookingServiceResult): SaveBookingServiceType => ({
    id: result.id,
})
