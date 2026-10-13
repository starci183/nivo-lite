import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListContentMediaLibraryQuery } from "../../application/list-content-media-library.query"
import { toContentMediaLibraryRequest, toContentMediaLibraryType } from "./content-media-library.mapper"
import { ContentMediaLibraryInput } from "./dto/content-media-library.input"
import { ContentMediaRefType } from "./dto/content-media-ref.type"

@Resolver()
/** GraphQL door of the selected workspace's private media library. */
export class ContentMediaLibraryResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists files a workspace member may attach to a post. */
    @Query(() => [ContentMediaRefType], { name: "contentMediaLibrary" })
    async contentMediaLibrary(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ContentMediaLibraryInput,
    ): Promise<Array<ContentMediaRefType>> {
        const result = await this.queryBus.execute(
            new ListContentMediaLibraryQuery({ request: toContentMediaLibraryRequest(workspaceId, input), principal }),
        )
        return toContentMediaLibraryType(result)
    }
}
