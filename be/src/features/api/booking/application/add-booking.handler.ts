import { CommandHandler } from "@nestjs/cqrs"
import { BookingDeskService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AddBookingResult } from "./add-booking.contracts"
import { AddBookingCommand } from "./add-booking.command"

@CommandHandler(AddBookingCommand)
/** Runs add-booking through one call of the BookingDeskService. */
export class AddBookingHandler extends ICQRSHandler<AddBookingCommand, AddBookingResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly desk: BookingDeskService,
    ) {
        super(logger)
    }

    protected override process(command: AddBookingCommand): Promise<AddBookingResult> {
        return this.desk.add(command.params.principal.id, command.params.request)
    }
}
