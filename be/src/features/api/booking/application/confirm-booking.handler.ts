import { CommandHandler } from "@nestjs/cqrs"
import { BookingDeskService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ConfirmBookingResult } from "./confirm-booking.contracts"
import { ConfirmBookingCommand } from "./confirm-booking.command"

@CommandHandler(ConfirmBookingCommand)
/** Runs confirm-booking through one call of the BookingDeskService. */
export class ConfirmBookingHandler extends ICQRSHandler<ConfirmBookingCommand, ConfirmBookingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly desk: BookingDeskService,
    ) {
        super(logger)
    }

    protected override process(command: ConfirmBookingCommand): Promise<ConfirmBookingResult> {
        return this.desk.confirm(command.params.principal.id, command.params.request)
    }
}
