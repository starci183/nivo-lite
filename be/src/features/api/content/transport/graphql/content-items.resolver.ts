import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListContentItemsQuery } from "../../application/content-items.query"
import { toContentItemsRequest, toContentItemsType } from "./content-items.mapper"
import { ContentItemsInput } from "./dto/content-items.input"
import { ContentItemType } from "./dto/content-item.type"

@Resolver()
/** The GraphQL door for contentItems. */
export class ListContentItemsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists workspace posts in schedule order, with optional schedule bounds. */
    @Query(() => [ContentItemType], { name: "contentItems" })
    async contentItems(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input", { type: () => ContentItemsInput, nullable: true }) input?: ContentItemsInput,
    ): Promise<Array<ContentItemType>> {
        const result = await this.queryBus.execute(
            new ListContentItemsQuery({ request: toContentItemsRequest(input, workspaceId), principal }),
        )
        return toContentItemsType(result)
    }
}
