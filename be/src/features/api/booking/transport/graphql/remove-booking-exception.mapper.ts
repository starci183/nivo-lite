import type {
    RemoveBookingExceptionRequest,
    RemoveBookingExceptionResult,
} from "../../application/remove-booking-exception.contracts"
import type { RemoveBookingExceptionInput } from "./dto/remove-booking-exception.input"
import type { RemoveBookingExceptionType } from "./dto/remove-booking-exception.type"

/** Maps the GraphQL arguments to the workspace-scoped request. */
export const toRemoveBookingExceptionRequest = (
    workspaceId: string,
    input: RemoveBookingExceptionInput,
): RemoveBookingExceptionRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the saved identity to the GraphQL result. */
export const toRemoveBookingExceptionType = (result: RemoveBookingExceptionResult): RemoveBookingExceptionType => ({
    id: result.id,
})
