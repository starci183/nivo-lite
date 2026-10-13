import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SaveBookingHoursResult } from "./save-booking-hours.contracts"
import { SaveBookingHoursCommand } from "./save-booking-hours.command"

@CommandHandler(SaveBookingHoursCommand)
/** Runs save-booking-hours through one call of the BookingSetupService. */
export class SaveBookingHoursHandler extends ICQRSHandler<SaveBookingHoursCommand, SaveBookingHoursResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveBookingHoursCommand): Promise<SaveBookingHoursResult> {
        return this.setup.saveHours(command.params.principal.id, command.params.request)
    }
}
