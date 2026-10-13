import { Query } from "@nestjs/cqrs"
import type { AccountingBookView } from "@modules/domain/accounting"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AccountingBookRequest } from "./accounting-book.contracts"

/** Requests the caller's accountingBook read model. */
export class AccountingBookQuery extends Query<AccountingBookView> {
    constructor(readonly params: ExecuteParams<AccountingBookRequest>) {
        super()
    }
}
