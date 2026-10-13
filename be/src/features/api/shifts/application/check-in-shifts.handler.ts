import { CommandHandler } from "@nestjs/cqrs"
import { ShiftsSetupService } from "@modules/domain/shifts"
import type { CheckInOutput } from "@modules/domain/shifts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckInShiftsCommand } from "./check-in-shifts.command"

@CommandHandler(CheckInShiftsCommand)
/** Check in to the caller's shift. */
export class CheckInShiftsHandler extends ICQRSHandler<CheckInShiftsCommand, CheckInOutput> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly setup: ShiftsSetupService,
    ) {
        super(logger)
    }

    protected override process(command: CheckInShiftsCommand): Promise<CheckInOutput> {
        return this.setup.checkIn(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
