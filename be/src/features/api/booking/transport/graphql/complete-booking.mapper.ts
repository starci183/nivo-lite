import type { CompleteBookingRequest, CompleteBookingResult } from "../../application/complete-booking.contracts"
import type { CompleteBookingInput } from "./dto/complete-booking.input"
import type { CompleteBookingType } from "./dto/complete-booking.type"

/** Maps the bounded GraphQL arguments to the workspace-scoped request. */
export const toCompleteBookingRequest = (workspaceId: string, input: CompleteBookingInput): CompleteBookingRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the application result to the GraphQL type. */
export const toCompleteBookingType = (result: CompleteBookingResult): CompleteBookingType => ({
    status: result.status,
    feeDue: result.feeDue,
})
