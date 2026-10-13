import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetVideoScopeQuery } from "../../application/get-video-scope.query"
import { toGetVideoScopeRequest, toGetVideoScopeType } from "./get-video-scope.mapper"
import { VideoScopeType } from "./dto/video-scope.type"

@Resolver()
/** GraphQL door of videoScope. */
export class GetVideoScopeResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** videoScope in the caller's checked workspace. */
    @Query(() => VideoScopeType, { name: "videoScope" })
    async videoScope(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<VideoScopeType> {
        const result = await this.queryBus.execute(
            new GetVideoScopeQuery({ request: toGetVideoScopeRequest(workspaceId), principal }),
        )
        return toGetVideoScopeType(result)
    }
}
