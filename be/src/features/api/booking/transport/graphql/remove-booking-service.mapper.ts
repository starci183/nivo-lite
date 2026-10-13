import type {
    RemoveBookingServiceRequest,
    RemoveBookingServiceResult,
} from "../../application/remove-booking-service.contracts"
import type { RemoveBookingServiceInput } from "./dto/remove-booking-service.input"
import type { RemoveBookingServiceType } from "./dto/remove-booking-service.type"

/** Maps the GraphQL arguments to the workspace-scoped request. */
export const toRemoveBookingServiceRequest = (
    workspaceId: string,
    input: RemoveBookingServiceInput,
): RemoveBookingServiceRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the saved identity to the GraphQL result. */
export const toRemoveBookingServiceType = (result: RemoveBookingServiceResult): RemoveBookingServiceType => ({
    id: result.id,
})
