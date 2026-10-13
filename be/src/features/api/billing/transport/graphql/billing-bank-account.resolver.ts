import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BillingBankAccountQuery } from "../../application/billing-bank-account.query"
import { toBillingBankAccountType } from "./billing-bank-account.mapper"
import { BillingBankAccountType } from "./dto/billing-bank-account.type"

@Resolver()
/** The recipient bank account shown before a payment order exists. */
export class BillingBankAccountResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the configured recipient account through the billing application. */
    @Query(() => BillingBankAccountType, { name: "billingBankAccount" })
    async billingBankAccount(@CurrentPrincipal() principal: Principal): Promise<BillingBankAccountType> {
        const result = await this.queryBus.execute(new BillingBankAccountQuery({ request: {}, principal }))
        return toBillingBankAccountType(result)
    }
}
