import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetCreditWorkUsageQuery } from "../../application/get-credit-work-usage.query"
import { toCreditWorkUsageRequest, toCreditWorkUsageType } from "./credit-work-usage.mapper"
import { CreditWorkUsageInput } from "./dto/credit-work-usage.input"
import { CreditWorkUsageType } from "./dto/credit-work-usage.type"

@Resolver()
/** The GraphQL door for the workspace's AI work per day, module and kind of work (owner and manager only). */
export class CreditWorkUsageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the AI work summary through its application handler. */
    @Query(() => [CreditWorkUsageType], { name: "creditWorkUsage" })
    async creditWorkUsage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreditWorkUsageInput,
    ): Promise<Array<CreditWorkUsageType>> {
        const result = await this.queryBus.execute(
            new GetCreditWorkUsageQuery({ request: toCreditWorkUsageRequest(workspaceId, input), principal }),
        )
        return toCreditWorkUsageType(result)
    }
}
