import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { BillingPlanQuoteQuery } from "../../application/billing-plan-quote.query"
import { BillingPlanQuoteInput } from "./dto/billing-plan-quote.input"
import { BillingPlanQuoteType } from "./dto/billing-plan-quote.type"
import { toBillingPlanQuoteRequest, toBillingPlanQuoteType } from "./billing-plan-quote.mapper"

@Resolver()
/** GraphQL door for billingPlanQuote. */
export class BillingPlanQuoteResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Prices a plan selection for the selected workspace. */
    @Query(() => BillingPlanQuoteType, { name: "billingPlanQuote" })
    async billingPlanQuote(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: BillingPlanQuoteInput,
    ): Promise<BillingPlanQuoteType> {
        const result = await this.queryBus.execute(
            new BillingPlanQuoteQuery({ request: toBillingPlanQuoteRequest(input, workspaceId), principal }),
        )
        return toBillingPlanQuoteType(result)
    }
}
