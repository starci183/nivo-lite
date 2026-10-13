import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveBookingResourceRequest, RemoveBookingResourceResult } from "./remove-booking-resource.contracts"

/** Dispatches remove-booking-resource for the authenticated caller. */
export class RemoveBookingResourceCommand extends Command<RemoveBookingResourceResult> {
    constructor(readonly params: ExecuteParams<RemoveBookingResourceRequest>) {
        super()
    }
}
