import type { CheckInBookingRequest, CheckInBookingResult } from "../../application/check-in-booking.contracts"
import type { CheckInBookingInput } from "./dto/check-in-booking.input"
import type { CheckInBookingType } from "./dto/check-in-booking.type"

/** Maps the bounded GraphQL arguments to the workspace-scoped request. */
export const toCheckInBookingRequest = (workspaceId: string, input: CheckInBookingInput): CheckInBookingRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the application result to the GraphQL type. */
export const toCheckInBookingType = (result: CheckInBookingResult): CheckInBookingType => ({
    status: result.status,
    feeDue: result.feeDue,
})
