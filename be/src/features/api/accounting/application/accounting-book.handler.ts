import { QueryHandler } from "@nestjs/cqrs"
import { AccountingService } from "@modules/domain/accounting"
import type { AccountingBookView } from "@modules/domain/accounting"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AccountingBookQuery } from "./accounting-book.query"

@QueryHandler(AccountingBookQuery)
/** Reads accountingBook through the member-scoped accounting service. */
export class AccountingBookHandler extends ICQRSHandler<AccountingBookQuery, AccountingBookView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounting: AccountingService,
    ) {
        super(logger)
    }
    protected override process(query: AccountingBookQuery): Promise<AccountingBookView> {
        return this.accounting.book(query.params.principal.id, query.params.request.workspaceId)
    }
}
