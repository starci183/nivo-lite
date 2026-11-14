import { QueryHandler } from "@nestjs/cqrs"
import { AccountDataRowsPageService, type AccountDataTypeView } from "@modules/domain/account-data"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AccountDataTypesQuery } from "./account-data-rows.queries"

@QueryHandler(AccountDataTypesQuery)
/** The declared data types a connected account stores, for an owner or a manager of its workspace. */
export class AccountDataTypesHandler extends ICQRSHandler<AccountDataTypesQuery, ReadonlyArray<AccountDataTypeView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly page: AccountDataRowsPageService,
    ) {
        super(logger)
    }

    protected override process(query: AccountDataTypesQuery): Promise<ReadonlyArray<AccountDataTypeView>> {
        return this.page.types(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
