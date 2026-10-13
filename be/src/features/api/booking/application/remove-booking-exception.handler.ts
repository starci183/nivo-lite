import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RemoveBookingExceptionResult } from "./remove-booking-exception.contracts"
import { RemoveBookingExceptionCommand } from "./remove-booking-exception.command"

@CommandHandler(RemoveBookingExceptionCommand)
/** Runs remove-booking-exception through one call of the BookingSetupService. */
export class RemoveBookingExceptionHandler extends ICQRSHandler<
    RemoveBookingExceptionCommand,
    RemoveBookingExceptionResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveBookingExceptionCommand): Promise<RemoveBookingExceptionResult> {
        return this.setup.removeException(command.params.principal.id, command.params.request)
    }
}
