import { CommandHandler } from "@nestjs/cqrs"
import { BookingDeskService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CompleteBookingResult } from "./complete-booking.contracts"
import { CompleteBookingCommand } from "./complete-booking.command"

@CommandHandler(CompleteBookingCommand)
/** Runs complete-booking through one call of the BookingDeskService. */
export class CompleteBookingHandler extends ICQRSHandler<CompleteBookingCommand, CompleteBookingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly desk: BookingDeskService,
    ) {
        super(logger)
    }

    protected override process(command: CompleteBookingCommand): Promise<CompleteBookingResult> {
        return this.desk.done(command.params.principal.id, command.params.request)
    }
}
