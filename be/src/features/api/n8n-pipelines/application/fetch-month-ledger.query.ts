import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { MonthLedger } from "@modules/domain/n8n-runs"
import type { FetchMonthLedgerRequest } from "./fetch-month-ledger.contracts"

/** Reads a month of the ledger for the accountant workflow. */
export class FetchMonthLedgerQuery extends Query<MonthLedger> {
    constructor(readonly params: PublicExecuteParams<FetchMonthLedgerRequest>) {
        super()
    }
}
