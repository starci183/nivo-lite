import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CheckInBookingRequest, CheckInBookingResult } from "./check-in-booking.contracts"

/** Records the arrival of the customer. */
export class CheckInBookingCommand extends Command<CheckInBookingResult> {
    constructor(readonly params: ExecuteParams<CheckInBookingRequest>) {
        super()
    }
}
