import { Query } from "@nestjs/cqrs"
import type { AccountingLedgerEntry } from "@modules/domain/accounting"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AccountingLedgerRequest } from "./accounting-ledger.contracts"

/** Requests the caller's accountingLedger read model. */
export class AccountingLedgerQuery extends Query<ReadonlyArray<AccountingLedgerEntry>> {
    constructor(readonly params: ExecuteParams<AccountingLedgerRequest>) {
        super()
    }
}
