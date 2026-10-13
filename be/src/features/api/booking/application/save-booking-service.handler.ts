import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SaveBookingServiceResult } from "./save-booking-service.contracts"
import { SaveBookingServiceCommand } from "./save-booking-service.command"

@CommandHandler(SaveBookingServiceCommand)
/** Runs save-booking-service through one call of the BookingSetupService. */
export class SaveBookingServiceHandler extends ICQRSHandler<SaveBookingServiceCommand, SaveBookingServiceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveBookingServiceCommand): Promise<SaveBookingServiceResult> {
        return this.setup.saveService(command.params.principal.id, command.params.request)
    }
}
