import { CommandHandler } from "@nestjs/cqrs"
import { ImapWizardService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveImapConnectionCommand } from "./save-imap-connection.command"

@CommandHandler(SaveImapConnectionCommand)
/** Saves a mailbox connection through the ImapWizardService. */
export class SaveImapConnectionHandler extends ICQRSHandler<SaveImapConnectionCommand, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: ImapWizardService,
    ) {
        super(logger)
    }

    protected override process(command: SaveImapConnectionCommand): Promise<string> {
        return this.wizard.save(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.input,
        )
    }
}
