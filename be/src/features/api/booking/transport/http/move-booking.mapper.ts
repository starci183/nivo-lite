import type { MoveBookingRequest, MoveBookingResult } from "../../application/move-booking.contracts"
import type { MoveBookingParamsRequest, MoveBookingBodyRequest } from "./dto/move-booking.request"
import type { MoveBookingResponse } from "./dto/move-booking.response"

/** Maps the HTTP input of move-booking to the command request. */
export const toMoveBookingRequest = (
    params: MoveBookingParamsRequest,
    body: MoveBookingBodyRequest,
): MoveBookingRequest => ({
    workspaceId: params.workspaceId,
    id: params.id,
    startAt: body.startAt,
    resourceId: body.resourceId,
    force: body.force,
})

/** Maps the move-booking result to the HTTP answer. */
export const toMoveBookingResponse = (result: MoveBookingResult): MoveBookingResponse => result
