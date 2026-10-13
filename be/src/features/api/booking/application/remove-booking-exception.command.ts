import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveBookingExceptionRequest, RemoveBookingExceptionResult } from "./remove-booking-exception.contracts"

/** Dispatches remove-booking-exception for the authenticated caller. */
export class RemoveBookingExceptionCommand extends Command<RemoveBookingExceptionResult> {
    constructor(readonly params: ExecuteParams<RemoveBookingExceptionRequest>) {
        super()
    }
}
