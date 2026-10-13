import { CommandHandler } from "@nestjs/cqrs"
import { BookingDeskService } from "@modules/domain/bookings"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MarkNoShowResult } from "./mark-no-show.contracts"
import { MarkNoShowCommand } from "./mark-no-show.command"

@CommandHandler(MarkNoShowCommand)
/** Runs mark-no-show through one call of the BookingDeskService. */
export class MarkNoShowHandler extends ICQRSHandler<MarkNoShowCommand, MarkNoShowResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly desk: BookingDeskService,
    ) {
        super(logger)
    }

    protected override process(command: MarkNoShowCommand): Promise<MarkNoShowResult> {
        return this.desk.noShow(command.params.principal.id, command.params.request)
    }
}
