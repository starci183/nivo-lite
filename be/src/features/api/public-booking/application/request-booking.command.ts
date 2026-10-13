import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RequestBookingRequest, RequestBookingResult } from "./request-booking.contracts"

/** Records a visitor's booking request. */
export class RequestBookingCommand extends Command<RequestBookingResult> {
    constructor(readonly params: PublicExecuteParams<RequestBookingRequest>) {
        super()
    }
}
