import type {
    RemoveBookingResourceRequest,
    RemoveBookingResourceResult,
} from "../../application/remove-booking-resource.contracts"
import type { RemoveBookingResourceInput } from "./dto/remove-booking-resource.input"
import type { RemoveBookingResourceType } from "./dto/remove-booking-resource.type"

/** Maps the GraphQL arguments to the workspace-scoped request. */
export const toRemoveBookingResourceRequest = (
    workspaceId: string,
    input: RemoveBookingResourceInput,
): RemoveBookingResourceRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the saved identity to the GraphQL result. */
export const toRemoveBookingResourceType = (result: RemoveBookingResourceResult): RemoveBookingResourceType => ({
    id: result.id,
})
