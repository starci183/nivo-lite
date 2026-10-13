import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RemoveBookingServiceRequest, RemoveBookingServiceResult } from "./remove-booking-service.contracts"

/** Dispatches remove-booking-service for the authenticated caller. */
export class RemoveBookingServiceCommand extends Command<RemoveBookingServiceResult> {
    constructor(readonly params: ExecuteParams<RemoveBookingServiceRequest>) {
        super()
    }
}
