import { CommandHandler } from "@nestjs/cqrs"
import { BookingPublicService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RequestBookingResult } from "./request-booking.contracts"
import { RequestBookingCommand } from "./request-booking.command"

@CommandHandler(RequestBookingCommand)
/** Runs request-booking through one call of the BookingPublicService. */
export class RequestBookingHandler extends ICQRSHandler<RequestBookingCommand, RequestBookingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly publicBooking: BookingPublicService,
    ) {
        super(logger)
    }

    protected override process(command: RequestBookingCommand): Promise<RequestBookingResult> {
        return this.publicBooking.book(command.params.request)
    }
}
