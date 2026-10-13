import { QueryHandler } from "@nestjs/cqrs"
import { AccountingService } from "@modules/domain/accounting"
import type { AccountingLedgerEntry } from "@modules/domain/accounting"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AccountingLedgerQuery } from "./accounting-ledger.query"

@QueryHandler(AccountingLedgerQuery)
/** Reads accountingLedger through the member-scoped accounting service. */
export class AccountingLedgerHandler extends ICQRSHandler<AccountingLedgerQuery, ReadonlyArray<AccountingLedgerEntry>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounting: AccountingService,
    ) {
        super(logger)
    }
    protected override process(query: AccountingLedgerQuery): Promise<ReadonlyArray<AccountingLedgerEntry>> {
        return this.accounting.ledger(query.params.principal.id, query.params.request.workspaceId)
    }
}
