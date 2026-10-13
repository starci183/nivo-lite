import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetContentItemQuery } from "../../application/content-item.query"
import { toContentItemRequest, toContentItemType } from "./content-item.mapper"
import { ContentItemInput } from "./dto/content-item.input"
import { ContentItemType } from "./dto/content-item.type"

@Resolver()
/** The GraphQL door for contentItem. */
export class GetContentItemResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads one post from the caller's workspace with its editor fields. */
    @Query(() => ContentItemType, { name: "contentItem" })
    async contentItem(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ContentItemInput,
    ): Promise<ContentItemType> {
        const result = await this.queryBus.execute(
            new GetContentItemQuery({ request: toContentItemRequest(input, workspaceId), principal }),
        )
        return toContentItemType(result)
    }
}
