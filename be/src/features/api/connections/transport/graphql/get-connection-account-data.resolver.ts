import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus, type Principal } from "@modules/platform/cqrs"
import { GetConnectionAccountDataQuery } from "../../application/get-connection-account-data.query"
import { AccountDataStatsType } from "./dto/account-data-stats.type"
import { GetConnectionAccountDataInput } from "./dto/get-connection-account-data.input"
import { toAccountDataStatsType, toGetConnectionAccountDataRequest } from "./get-connection-account-data.mapper"

@Resolver()
/** GraphQL door of connectionAccountData. */
export class GetConnectionAccountDataResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** What an account keeps of its provider data: per declared type, its rows and its newest one. */
    @Query(() => AccountDataStatsType, { name: "connectionAccountData" })
    async connectionAccountData(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetConnectionAccountDataInput,
    ): Promise<AccountDataStatsType> {
        const result = await this.queryBus.execute(
            new GetConnectionAccountDataQuery({
                request: toGetConnectionAccountDataRequest(workspaceId, input),
                principal,
            }),
        )
        return toAccountDataStatsType(result)
    }
}
