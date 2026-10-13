import { CommandHandler } from "@nestjs/cqrs"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateResponsibilityCommand } from "./create-responsibility.command"

@CommandHandler(CreateResponsibilityCommand)
/** Adds the responsibility through the journal service. */
export class CreateResponsibilityHandler extends ICQRSHandler<CreateResponsibilityCommand, ResponsibilityRecord> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly journal: ResponsibilityJournalService,
    ) {
        super(logger)
    }

    protected override process(command: CreateResponsibilityCommand): Promise<ResponsibilityRecord> {
        return this.journal.create(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.input,
        )
    }
}
