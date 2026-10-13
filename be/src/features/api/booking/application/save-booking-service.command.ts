import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveBookingServiceRequest, SaveBookingServiceResult } from "./save-booking-service.contracts"

/** Dispatches save-booking-service for the authenticated caller. */
export class SaveBookingServiceCommand extends Command<SaveBookingServiceResult> {
    constructor(readonly params: ExecuteParams<SaveBookingServiceRequest>) {
        super()
    }
}
