import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SaveBookingResourceResult } from "./save-booking-resource.contracts"
import { SaveBookingResourceCommand } from "./save-booking-resource.command"

@CommandHandler(SaveBookingResourceCommand)
/** Runs save-booking-resource through one call of the BookingSetupService. */
export class SaveBookingResourceHandler extends ICQRSHandler<SaveBookingResourceCommand, SaveBookingResourceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveBookingResourceCommand): Promise<SaveBookingResourceResult> {
        return this.setup.saveResource(command.params.principal.id, command.params.request)
    }
}
