import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListVideoSourcesQuery } from "../../application/list-video-sources.query"
import { toListVideoSourcesRequest, toListVideoSourcesType } from "./list-video-sources.mapper"
import { VideoSourceType } from "./dto/video-source.type"

@Resolver()
/** GraphQL door of videoSources. */
export class ListVideoSourcesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** videoSources in the caller's checked workspace. */
    @Query(() => [VideoSourceType], { name: "videoSources" })
    async videoSources(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<VideoSourceType>> {
        const result = await this.queryBus.execute(
            new ListVideoSourcesQuery({ request: toListVideoSourcesRequest(workspaceId), principal }),
        )
        return toListVideoSourcesType(result)
    }
}
