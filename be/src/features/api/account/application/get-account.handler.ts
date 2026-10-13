import { QueryHandler } from "@nestjs/cqrs"
import { AccountsService } from "@modules/domain/accounts"
import type { AccountOverview } from "@modules/domain/accounts"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAccountQuery } from "./get-account.query"

@QueryHandler(GetAccountQuery)
/** Answers the account overview from the accounts service. */
export class GetAccountHandler extends ICQRSHandler<GetAccountQuery, AccountOverview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: AccountsService,
    ) {
        super(logger)
    }

    protected override process(query: GetAccountQuery): Promise<AccountOverview> {
        return this.accounts.overview(query.params.principal.id, query.params.principal.sessionId)
    }
}
