import { CommandHandler } from "@nestjs/cqrs"
import { BookingDeskService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MoveBookingResult } from "./move-booking.contracts"
import { MoveBookingCommand } from "./move-booking.command"

@CommandHandler(MoveBookingCommand)
/** Runs move-booking through one call of the BookingDeskService. */
export class MoveBookingHandler extends ICQRSHandler<MoveBookingCommand, MoveBookingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly desk: BookingDeskService,
    ) {
        super(logger)
    }

    protected override process(command: MoveBookingCommand): Promise<MoveBookingResult> {
        return this.desk.move(command.params.principal.id, command.params.request)
    }
}
