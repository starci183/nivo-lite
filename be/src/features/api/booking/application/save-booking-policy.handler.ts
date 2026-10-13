import { CommandHandler } from "@nestjs/cqrs"
import { BookingSetupService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SaveBookingPolicyResult } from "./save-booking-policy.contracts"
import { SaveBookingPolicyCommand } from "./save-booking-policy.command"

@CommandHandler(SaveBookingPolicyCommand)
/** Runs save-booking-policy through one call of the BookingSetupService. */
export class SaveBookingPolicyHandler extends ICQRSHandler<SaveBookingPolicyCommand, SaveBookingPolicyResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: BookingSetupService,
    ) {
        super(logger)
    }

    protected override process(command: SaveBookingPolicyCommand): Promise<SaveBookingPolicyResult> {
        return this.setup.savePolicy(command.params.principal.id, command.params.request)
    }
}
