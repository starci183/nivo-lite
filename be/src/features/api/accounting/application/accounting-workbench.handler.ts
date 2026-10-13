import { QueryHandler } from "@nestjs/cqrs"
import { AccountingService } from "@modules/domain/accounting"
import type { AccountingWorkbenchView } from "@modules/domain/accounting"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AccountingWorkbenchQuery } from "./accounting-workbench.query"

@QueryHandler(AccountingWorkbenchQuery)
/** Reads accountingWorkbench through the member-scoped accounting service. */
export class AccountingWorkbenchHandler extends ICQRSHandler<AccountingWorkbenchQuery, AccountingWorkbenchView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounting: AccountingService,
    ) {
        super(logger)
    }
    protected override process(query: AccountingWorkbenchQuery): Promise<AccountingWorkbenchView> {
        return this.accounting.workbench(query.params.principal.id, query.params.request.workspaceId)
    }
}
