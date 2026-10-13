import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BillingPlanQuery } from "../../application/billing-plan.query"
import { BillingPlanType } from "./dto/billing-plan.type"
import { BillingPlanInput } from "./dto/billing-plan.input"
import { toBillingPlanRequest, toBillingPlanType } from "./billing-plan.mapper"

@Resolver()
/** GraphQL door for billingPlan. */
export class BillingPlanResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads billingPlan for the authenticated caller. */
    @Query(() => BillingPlanType, { name: "billingPlan", nullable: true })
    async billingPlan(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: BillingPlanInput,
    ): Promise<BillingPlanType | null> {
        const result = await this.queryBus.execute(
            new BillingPlanQuery({ request: toBillingPlanRequest(input), principal }),
        )
        return toBillingPlanType(result)
    }
}
