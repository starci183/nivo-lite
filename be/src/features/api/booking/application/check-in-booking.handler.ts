import { CommandHandler } from "@nestjs/cqrs"
import { BookingDeskService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CheckInBookingResult } from "./check-in-booking.contracts"
import { CheckInBookingCommand } from "./check-in-booking.command"

@CommandHandler(CheckInBookingCommand)
/** Runs check-in-booking through one call of the BookingDeskService. */
export class CheckInBookingHandler extends ICQRSHandler<CheckInBookingCommand, CheckInBookingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly desk: BookingDeskService,
    ) {
        super(logger)
    }

    protected override process(command: CheckInBookingCommand): Promise<CheckInBookingResult> {
        return this.desk.checkIn(command.params.principal.id, command.params.request)
    }
}
