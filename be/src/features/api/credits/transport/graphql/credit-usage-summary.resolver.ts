import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetCreditUsageSummaryQuery } from "../../application/get-credit-usage-summary.query"
import { toCreditUsageSummaryRequest, toCreditUsageSummaryType } from "./credit-usage-summary.mapper"
import { CreditUsageSummaryType } from "./dto/credit-usage-summary.type"

@Resolver()
/** The GraphQL door for credit usage summary. */
export class CreditUsageSummaryResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the quota, module split and daily series through its application handler. */
    @Query(() => CreditUsageSummaryType, { name: "creditUsageSummary" })
    async creditUsageSummary(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<CreditUsageSummaryType> {
        const result = await this.queryBus.execute(
            new GetCreditUsageSummaryQuery({ request: toCreditUsageSummaryRequest(workspaceId), principal }),
        )
        return toCreditUsageSummaryType(result)
    }
}
