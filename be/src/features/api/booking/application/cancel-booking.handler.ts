import { CommandHandler } from "@nestjs/cqrs"
import { BookingDeskService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { CancelBookingResult } from "./cancel-booking.contracts"
import { CancelBookingCommand } from "./cancel-booking.command"

@CommandHandler(CancelBookingCommand)
/** Runs cancel-booking through one call of the BookingDeskService. */
export class CancelBookingHandler extends ICQRSHandler<CancelBookingCommand, CancelBookingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly desk: BookingDeskService,
    ) {
        super(logger)
    }

    protected override process(command: CancelBookingCommand): Promise<CancelBookingResult> {
        return this.desk.cancel(command.params.principal.id, command.params.request)
    }
}
