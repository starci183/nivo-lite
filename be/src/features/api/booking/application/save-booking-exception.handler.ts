import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SaveBookingExceptionResult } from "./save-booking-exception.contracts"
import { SaveBookingExceptionCommand } from "./save-booking-exception.command"

@CommandHandler(SaveBookingExceptionCommand)
/** Runs save-booking-exception through one call of the BookingSetupService. */
export class SaveBookingExceptionHandler extends ICQRSHandler<SaveBookingExceptionCommand, SaveBookingExceptionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveBookingExceptionCommand): Promise<SaveBookingExceptionResult> {
        return this.setup.saveException(command.params.principal.id, command.params.request)
    }
}
