import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveBookingResourceRequest, SaveBookingResourceResult } from "./save-booking-resource.contracts"

/** Dispatches save-booking-resource for the authenticated caller. */
export class SaveBookingResourceCommand extends Command<SaveBookingResourceResult> {
    constructor(readonly params: ExecuteParams<SaveBookingResourceRequest>) {
        super()
    }
}
