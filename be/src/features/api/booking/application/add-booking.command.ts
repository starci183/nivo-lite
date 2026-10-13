import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AddBookingRequest, AddBookingResult } from "./add-booking.contracts"

/** Adds a booking by hand. */
export class AddBookingCommand extends Command<AddBookingResult> {
    constructor(readonly params: ExecuteParams<AddBookingRequest>) {
        super()
    }
}
