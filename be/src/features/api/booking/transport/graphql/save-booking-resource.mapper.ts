import type { SaveBookingResourceResult } from "../../application/save-booking-resource.contracts"
import type { SaveBookingResourceType } from "./dto/save-booking-resource.type"

export { toSaveBookingResourceRequest } from "@modules/domain/bookings"

/** Maps the saved identity to the GraphQL result. */
export const toSaveBookingResourceType = (result: SaveBookingResourceResult): SaveBookingResourceType => ({
    id: result.id,
})
