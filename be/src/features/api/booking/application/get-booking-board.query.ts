import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetBookingBoardRequest, GetBookingBoardResult } from "./get-booking-board.contracts"

/** Reads the booking workbench for a workspace member. */
export class GetBookingBoardQuery extends Query<GetBookingBoardResult> {
    constructor(readonly params: ExecuteParams<GetBookingBoardRequest>) {
        super()
    }
}
