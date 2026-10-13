import { CommandHandler } from "@nestjs/cqrs"
import { DatabaseWizardService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveDatabaseConnectionCommand } from "./save-database-connection.command"

@CommandHandler(SaveDatabaseConnectionCommand)
/** Saves a database connection through the DatabaseWizardService. */
export class SaveDatabaseConnectionHandler extends ICQRSHandler<SaveDatabaseConnectionCommand, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: DatabaseWizardService,
    ) {
        super(logger)
    }

    protected override process(command: SaveDatabaseConnectionCommand): Promise<string> {
        return this.wizard.save(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request,
        )
    }
}
