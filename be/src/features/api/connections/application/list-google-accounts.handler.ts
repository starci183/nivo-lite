import { QueryHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GoogleAccount } from "@modules/domain/google-connections"
import { ListGoogleAccountsQuery } from "./list-google-accounts.query"

@QueryHandler(ListGoogleAccountsQuery)
/** Asks for the live Google accounts of the workspace through the GoogleConnectionsService. */
export class ListGoogleAccountsHandler extends ICQRSHandler<ListGoogleAccountsQuery, ReadonlyArray<GoogleAccount>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly google: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: ListGoogleAccountsQuery): Promise<ReadonlyArray<GoogleAccount>> {
        return this.google.accounts({
            principalId: query.params.principal.id,
            workspaceId: query.params.request.workspaceId,
        })
    }
}
