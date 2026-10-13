import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveBookingHoursRequest, SaveBookingHoursResult } from "./save-booking-hours.contracts"

/** Dispatches save-booking-hours for the authenticated caller. */
export class SaveBookingHoursCommand extends Command<SaveBookingHoursResult> {
    constructor(readonly params: ExecuteParams<SaveBookingHoursRequest>) {
        super()
    }
}
