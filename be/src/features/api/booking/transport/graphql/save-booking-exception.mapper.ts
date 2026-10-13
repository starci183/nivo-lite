import type { SaveBookingExceptionResult } from "../../application/save-booking-exception.contracts"
import type { SaveBookingExceptionType } from "./dto/save-booking-exception.type"

export { toSaveBookingExceptionRequest } from "@modules/domain/bookings"

/** Maps the saved identity to the GraphQL result. */
export const toSaveBookingExceptionType = (result: SaveBookingExceptionResult): SaveBookingExceptionType => ({
    id: result.id,
})
