import type { MoveBookingRequest } from "../../application/move-booking.contracts"
import type { MoveBookingInput } from "./dto/move-booking.input"

/** Maps the bounded GraphQL arguments to the workspace-scoped request. */
export const toMoveBookingRequest = (workspaceId: string, input: MoveBookingInput): MoveBookingRequest => ({
    workspaceId,
    id: input.id,
    startAt: input.startAt,
    resourceId: input.resourceId,
    force: input.force,
})

export { toMoveBookingType } from "@modules/domain/bookings"
