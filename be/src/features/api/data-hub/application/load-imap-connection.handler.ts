import { QueryHandler } from "@nestjs/cqrs"
import { ImapWizardService } from "@modules/domain/data-hub"
import type { ImapView } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LoadImapConnectionQuery } from "./load-imap-connection.query"

@QueryHandler(LoadImapConnectionQuery)
/** Reads a saved mailbox through the ImapWizardService. */
export class LoadImapConnectionHandler extends ICQRSHandler<LoadImapConnectionQuery, ImapView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: ImapWizardService,
    ) {
        super(logger)
    }

    protected override process(query: LoadImapConnectionQuery): Promise<ImapView> {
        return this.wizard.load(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
