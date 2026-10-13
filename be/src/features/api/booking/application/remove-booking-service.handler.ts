import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RemoveBookingServiceResult } from "./remove-booking-service.contracts"
import { RemoveBookingServiceCommand } from "./remove-booking-service.command"

@CommandHandler(RemoveBookingServiceCommand)
/** Runs remove-booking-service through one call of the BookingSetupService. */
export class RemoveBookingServiceHandler extends ICQRSHandler<RemoveBookingServiceCommand, RemoveBookingServiceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveBookingServiceCommand): Promise<RemoveBookingServiceResult> {
        return this.setup.removeService(command.params.principal.id, command.params.request)
    }
}
