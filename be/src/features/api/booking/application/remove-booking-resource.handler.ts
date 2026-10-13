import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RemoveBookingResourceResult } from "./remove-booking-resource.contracts"
import { RemoveBookingResourceCommand } from "./remove-booking-resource.command"

@CommandHandler(RemoveBookingResourceCommand)
/** Runs remove-booking-resource through one call of the BookingSetupService. */
export class RemoveBookingResourceHandler extends ICQRSHandler<
    RemoveBookingResourceCommand,
    RemoveBookingResourceResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveBookingResourceCommand): Promise<RemoveBookingResourceResult> {
        return this.setup.removeResource(command.params.principal.id, command.params.request)
    }
}
