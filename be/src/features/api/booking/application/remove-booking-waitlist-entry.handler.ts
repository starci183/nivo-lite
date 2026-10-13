import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RemoveBookingWaitlistEntryResult } from "./remove-booking-waitlist-entry.contracts"
import { RemoveBookingWaitlistEntryCommand } from "./remove-booking-waitlist-entry.command"

@CommandHandler(RemoveBookingWaitlistEntryCommand)
/** Runs remove-booking-waitlist-entry through one call of the BookingSetupService. */
export class RemoveBookingWaitlistEntryHandler extends ICQRSHandler<
    RemoveBookingWaitlistEntryCommand,
    RemoveBookingWaitlistEntryResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveBookingWaitlistEntryCommand): Promise<RemoveBookingWaitlistEntryResult> {
        return this.setup.removeWaitlistEntry(command.params.principal.id, command.params.request)
    }
}
