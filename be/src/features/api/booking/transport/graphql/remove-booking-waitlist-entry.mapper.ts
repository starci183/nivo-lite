import type {
    RemoveBookingWaitlistEntryRequest,
    RemoveBookingWaitlistEntryResult,
} from "../../application/remove-booking-waitlist-entry.contracts"
import type { RemoveBookingWaitlistEntryInput } from "./dto/remove-booking-waitlist-entry.input"
import type { RemoveBookingWaitlistEntryType } from "./dto/remove-booking-waitlist-entry.type"

/** Maps the GraphQL arguments to the workspace-scoped request. */
export const toRemoveBookingWaitlistEntryRequest = (
    workspaceId: string,
    input: RemoveBookingWaitlistEntryInput,
): RemoveBookingWaitlistEntryRequest => ({
    workspaceId,
    id: input.id,
})

/** Maps the saved identity to the GraphQL result. */
export const toRemoveBookingWaitlistEntryType = (
    result: RemoveBookingWaitlistEntryResult,
): RemoveBookingWaitlistEntryType => ({ id: result.id })
