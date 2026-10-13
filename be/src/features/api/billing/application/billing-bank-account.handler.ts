import { QueryHandler } from "@nestjs/cqrs"
import { BillingService } from "@modules/domain/billing"
import type { BankAccountOptions } from "@modules/domain/billing"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingBankAccountQuery } from "./billing-bank-account.query"

@QueryHandler(BillingBankAccountQuery)
/** Answers the account customers pay into, without exposing secret provider configuration. */
export class BillingBankAccountHandler extends ICQRSHandler<BillingBankAccountQuery, BankAccountOptions> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly billing: BillingService,
    ) {
        super(logger)
    }

    protected override process(_query: BillingBankAccountQuery): Promise<BankAccountOptions> {
        return this.billing.bankAccount()
    }
}
