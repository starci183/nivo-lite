import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CancelBookingRequest, CancelBookingResult } from "./cancel-booking.contracts"

/** Cancels a booking. */
export class CancelBookingCommand extends Command<CancelBookingResult> {
    constructor(readonly params: ExecuteParams<CancelBookingRequest>) {
        super()
    }
}
