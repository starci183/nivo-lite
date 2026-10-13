import type { QueryBus } from "@nestjs/cqrs"
import { Args, Float, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetCreditRecentCostUsdQuery } from "../../application/get-credit-recent-cost-usd.query"
import { toCreditRecentCostUsdRequest, toCreditRecentCostUsdType } from "./credit-recent-cost-usd.mapper"
import { CreditRecentCostInput } from "./dto/credit-recent-cost.input"

@Resolver()
/** The GraphQL door for recent model cost. */
export class CreditRecentCostUsdResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the cost from a selected day through its application handler. */
    @Query(() => Float, { name: "creditRecentCostUsd" })
    async creditRecentCostUsd(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreditRecentCostInput,
    ): Promise<number> {
        const result = await this.queryBus.execute(
            new GetCreditRecentCostUsdQuery({ request: toCreditRecentCostUsdRequest(workspaceId, input), principal }),
        )
        return toCreditRecentCostUsdType(result)
    }
}
