import { Query } from "@nestjs/cqrs"
import type { BankAccountOptions } from "@modules/domain/billing"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BillingBankAccountRequest } from "./billing-bank-account.contracts"

/** Asks for the account customers pay into. */
export class BillingBankAccountQuery extends Query<BankAccountOptions> {
    constructor(readonly params: ExecuteParams<BillingBankAccountRequest>) {
        super()
    }
}
