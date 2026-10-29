import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ApplyBookingEffectsRequest, ApplyBookingEffectsResult } from "./apply-booking-effects.contracts"

/** Asks to apply one delivered booking_status_changed event; the booking_status_changed consumer sends it for every delivery. */
export class ApplyBookingEffectsCommand extends Command<ApplyBookingEffectsResult> {
    constructor(readonly params: PublicExecuteParams<ApplyBookingEffectsRequest>) {
        super()
    }
}
