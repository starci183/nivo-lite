import { CommandHandler } from "@nestjs/cqrs"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateResponsibilityStatusCommand } from "./update-responsibility-status.command"

@CommandHandler(UpdateResponsibilityStatusCommand)
/** Moves the responsibility through the journal service. */
export class UpdateResponsibilityStatusHandler extends ICQRSHandler<
    UpdateResponsibilityStatusCommand,
    ResponsibilityRecord
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly journal: ResponsibilityJournalService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateResponsibilityStatusCommand): Promise<ResponsibilityRecord> {
        return this.journal.updateStatus(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.responsibilityId,
            command.params.request.status,
        )
    }
}
