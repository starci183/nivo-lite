import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SaveBookingPublicPageResult } from "./save-booking-public-page.contracts"
import { SaveBookingPublicPageCommand } from "./save-booking-public-page.command"

@CommandHandler(SaveBookingPublicPageCommand)
/** Runs save-booking-public-page through one call of the BookingSetupService. */
export class SaveBookingPublicPageHandler extends ICQRSHandler<
    SaveBookingPublicPageCommand,
    SaveBookingPublicPageResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveBookingPublicPageCommand): Promise<SaveBookingPublicPageResult> {
        return this.setup.savePublicPage(command.params.principal.id, command.params.request)
    }
}
