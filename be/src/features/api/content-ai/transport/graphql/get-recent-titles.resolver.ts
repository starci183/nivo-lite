import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetRecentTitlesQuery } from "../../application/get-recent-titles.query"
import { GetRecentTitlesInput } from "./dto/get-recent-titles.input"
import { toRecentTitlesRequest, toRecentTitlesType } from "./get-recent-titles.mapper"

@Resolver()
/** GraphQL door for recent content titles. */
export class GetRecentTitlesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Returns recent titles without including the selected content item. */
    @Query(() => [String], { name: "contentRecentTitles" })
    async contentRecentTitles(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetRecentTitlesInput,
    ): Promise<Array<string>> {
        const result = await this.queryBus.execute(
            new GetRecentTitlesQuery({ request: toRecentTitlesRequest(input, workspaceId), principal }),
        )
        return toRecentTitlesType(result)
    }
}
