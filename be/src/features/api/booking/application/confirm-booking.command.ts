import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ConfirmBookingRequest, ConfirmBookingResult } from "./confirm-booking.contracts"

/** Confirms a requested booking. */
export class ConfirmBookingCommand extends Command<ConfirmBookingResult> {
    constructor(readonly params: ExecuteParams<ConfirmBookingRequest>) {
        super()
    }
}
