import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BillingPlansQuery } from "../../application/billing-plans.query"
import { BillingPlanType } from "./dto/billing-plan.type"
import { toBillingPlansType } from "./billing-plans.mapper"

@Resolver()
/** GraphQL door for billingPlans. */
export class BillingPlansResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads billingPlans for the authenticated caller. */
    @Query(() => [BillingPlanType], { name: "billingPlans" })
    async billingPlans(@CurrentPrincipal() principal: Principal): Promise<ReadonlyArray<BillingPlanType>> {
        const result = await this.queryBus.execute(new BillingPlansQuery({ request: {}, principal }))
        return toBillingPlansType(result)
    }
}
