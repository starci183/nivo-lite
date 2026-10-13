import type { BankAccountOptions } from "@modules/domain/billing"
import type { BillingBankAccountType } from "./dto/billing-bank-account.type"

/** Maps the recipient account to its GraphQL type. */
export const toBillingBankAccountType = (result: BankAccountOptions): BillingBankAccountType => ({
    account: result.account,
    bank: result.bank,
    holder: result.holder,
})
