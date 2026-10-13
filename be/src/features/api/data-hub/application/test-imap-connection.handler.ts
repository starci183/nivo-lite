import { QueryHandler } from "@nestjs/cqrs"
import { ImapWizardService } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TestImapConnectionQuery } from "./test-imap-connection.query"

@QueryHandler(TestImapConnectionQuery)
/** Tries a mailbox login through the ImapWizardService. */
export class TestImapConnectionHandler extends ICQRSHandler<TestImapConnectionQuery, Array<string>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly wizard: ImapWizardService,
    ) {
        super(logger)
    }

    protected override process(query: TestImapConnectionQuery): Promise<Array<string>> {
        return this.wizard.test(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.input,
        )
    }
}
