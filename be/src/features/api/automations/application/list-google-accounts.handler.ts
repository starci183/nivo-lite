import { QueryHandler } from "@nestjs/cqrs"
import { AutomationsService } from "@modules/domain/automations"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListGoogleAccountsQuery } from "./list-google-accounts.query"
import type { ListGoogleAccountsResult } from "./list-google-accounts.contracts"

@QueryHandler(ListGoogleAccountsQuery)
/** Lists the Google accounts a spreadsheet automation can write with. */
export class ListGoogleAccountsHandler extends ICQRSHandler<ListGoogleAccountsQuery, ListGoogleAccountsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly automations: AutomationsService,
    ) {
        super(logger)
    }

    protected override process(message: ListGoogleAccountsQuery): Promise<ListGoogleAccountsResult> {
        return this.automations.googleAccounts(message.params.principal.id, message.params.request.workspaceId)
    }
}
