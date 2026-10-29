import { CommandHandler } from "@nestjs/cqrs"
import { BookingEffectsService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApplyBookingEffectsCommand } from "./apply-booking-effects.command"
import type { ApplyBookingEffectsResult } from "./apply-booking-effects.contracts"

@CommandHandler(ApplyBookingEffectsCommand)
/** Hands the delivered booking_status_changed event to the domain service, which claims the delivery in the inbox and applies the change in one transaction. */
export class ApplyBookingEffectsHandler extends ICQRSHandler<ApplyBookingEffectsCommand, ApplyBookingEffectsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly effects: BookingEffectsService,
    ) {
        super(logger)
    }

    protected override process(command: ApplyBookingEffectsCommand): Promise<ApplyBookingEffectsResult> {
        return this.effects.apply(command.params.request.delivery.event.payload, {
            consumer: command.params.request.delivery.consumer,
            dedupeKey: command.params.request.delivery.dedupeKey,
        })
    }
}
