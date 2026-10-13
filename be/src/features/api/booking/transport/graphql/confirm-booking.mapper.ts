import type { ConfirmBookingRequest, ConfirmBookingResult } from "../../application/confirm-booking.contracts"
import type { ConfirmBookingInput } from "./dto/confirm-booking.input"
import type { ConfirmBookingType } from "./dto/confirm-booking.type"

/** Maps the bounded GraphQL arguments to the workspace-scoped request. */
export const toConfirmBookingRequest = (workspaceId: string, input: ConfirmBookingInput): ConfirmBookingRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the application result to the GraphQL type. */
export const toConfirmBookingType = (result: ConfirmBookingResult): ConfirmBookingType => ({
    status: result.status,
    feeDue: result.feeDue,
})
