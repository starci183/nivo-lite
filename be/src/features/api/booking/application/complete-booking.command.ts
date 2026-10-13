import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CompleteBookingRequest, CompleteBookingResult } from "./complete-booking.contracts"

/** Marks a booking done. */
export class CompleteBookingCommand extends Command<CompleteBookingResult> {
    constructor(readonly params: ExecuteParams<CompleteBookingRequest>) {
        super()
    }
}
