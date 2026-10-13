import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type {
    RemoveBookingWaitlistEntryRequest,
    RemoveBookingWaitlistEntryResult,
} from "./remove-booking-waitlist-entry.contracts"

/** Dispatches remove-booking-waitlist-entry for the authenticated caller. */
export class RemoveBookingWaitlistEntryCommand extends Command<RemoveBookingWaitlistEntryResult> {
    constructor(readonly params: ExecuteParams<RemoveBookingWaitlistEntryRequest>) {
        super()
    }
}
