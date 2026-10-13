import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MoveBookingRequest, MoveBookingResult } from "./move-booking.contracts"

/** Moves a booking to another time or resource. */
export class MoveBookingCommand extends Command<MoveBookingResult> {
    constructor(readonly params: ExecuteParams<MoveBookingRequest>) {
        super()
    }
}
