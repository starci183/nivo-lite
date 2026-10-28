import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetZaloPageQuery } from "../../application/get-zalo-page.query"
import { GetZaloPageInput } from "./dto/get-zalo-page.input"
import { ZaloPageType } from "./dto/zalo-page.type"
import { toGetZaloPageRequest, toGetZaloPageType } from "./get-zalo-page.mapper"

@Resolver()
/** GraphQL door of zaloConnectionPage. */
export class GetZaloPageResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Asks for the page of a Zalo OA connection. */
    @Query(() => ZaloPageType, { name: "zaloConnectionPage" })
    async zaloConnectionPage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetZaloPageInput,
    ): Promise<ZaloPageType> {
        const result = await this.queryBus.execute(
            new GetZaloPageQuery({ request: toGetZaloPageRequest(workspaceId, input), principal }),
        )
        return toGetZaloPageType(result)
    }
}
