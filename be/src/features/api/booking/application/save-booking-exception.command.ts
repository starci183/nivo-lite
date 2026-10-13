import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveBookingExceptionRequest, SaveBookingExceptionResult } from "./save-booking-exception.contracts"

/** Dispatches save-booking-exception for the authenticated caller. */
export class SaveBookingExceptionCommand extends Command<SaveBookingExceptionResult> {
    constructor(readonly params: ExecuteParams<SaveBookingExceptionRequest>) {
        super()
    }
}
