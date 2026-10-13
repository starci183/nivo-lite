import type { SaveBookingHoursRequest, SaveBookingHoursResult } from "../../application/save-booking-hours.contracts"
import type { SaveBookingHoursInput } from "./dto/save-booking-hours.input"
import type { SaveBookingHoursType } from "./dto/save-booking-hours.type"

/** Maps the GraphQL arguments to the workspace-scoped request. */
export const toSaveBookingHoursRequest = (
    workspaceId: string,
    input: SaveBookingHoursInput,
): SaveBookingHoursRequest => ({
    workspaceId,
    resourceId: input.resourceId,
    rows: input.rows,
})

/** Maps the saved identity to the GraphQL result. */
export const toSaveBookingHoursType = (result: SaveBookingHoursResult): SaveBookingHoursType => ({ id: result.id })
