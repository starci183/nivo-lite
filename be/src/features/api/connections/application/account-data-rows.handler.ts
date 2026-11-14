import { QueryHandler } from "@nestjs/cqrs"
import { AccountDataRowsPageService, type AccountDataRowsAnswer } from "@modules/domain/account-data"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AccountDataRowsQuery } from "./account-data-rows.queries"

@QueryHandler(AccountDataRowsQuery)
/** The newest rows of one declared data type of a connected account, for an owner or a manager of its workspace. */
export class AccountDataRowsHandler extends ICQRSHandler<AccountDataRowsQuery, AccountDataRowsAnswer> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: AccountDataRowsPageService,
    ) {
        super(logger)
    }

    protected override process(query: AccountDataRowsQuery): Promise<AccountDataRowsAnswer> {
        return this.page.rows(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request,
        )
    }
}
