import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveBookingPolicyRequest, SaveBookingPolicyResult } from "./save-booking-policy.contracts"

/** Dispatches save-booking-policy for the authenticated caller. */
export class SaveBookingPolicyCommand extends Command<SaveBookingPolicyResult> {
    constructor(readonly params: ExecuteParams<SaveBookingPolicyRequest>) {
        super()
    }
}
