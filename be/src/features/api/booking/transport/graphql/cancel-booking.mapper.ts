import type { CancelBookingRequest, CancelBookingResult } from "../../application/cancel-booking.contracts"
import type { CancelBookingInput } from "./dto/cancel-booking.input"
import type { CancelBookingType } from "./dto/cancel-booking.type"

/** Maps the bounded GraphQL arguments to the workspace-scoped request. */
export const toCancelBookingRequest = (workspaceId: string, input: CancelBookingInput): CancelBookingRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the application result to the GraphQL type. */
export const toCancelBookingType = (result: CancelBookingResult): CancelBookingType => ({
    status: result.status,
    feeDue: result.feeDue,
})
