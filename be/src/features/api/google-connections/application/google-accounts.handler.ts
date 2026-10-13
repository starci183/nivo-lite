import { QueryHandler } from "@nestjs/cqrs"
import { GoogleConnectionsService } from "@modules/domain/google-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GoogleAccountsQuery } from "./google-accounts.query"
import type { GoogleAccountsResult } from "./google-accounts.contracts"

@QueryHandler(GoogleAccountsQuery)
/** Lists the live Google accounts of the workspace. */
export class GoogleAccountsHandler extends ICQRSHandler<GoogleAccountsQuery, GoogleAccountsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly googleConnectionsService: GoogleConnectionsService,
    ) {
        super(logger)
    }

    protected override process(query: GoogleAccountsQuery): Promise<GoogleAccountsResult> {
        const { request } = query.params
        return this.googleConnectionsService.accounts({
            principalId: query.params.principal.id,
            workspaceId: request.workspaceId,
        })
    }
}
