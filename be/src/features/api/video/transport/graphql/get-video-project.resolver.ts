import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetVideoProjectQuery } from "../../application/get-video-project.query"
import { toGetVideoProjectRequest, toGetVideoProjectType } from "./get-video-project.mapper"
import { GetVideoProjectInput } from "./dto/get-video-project.input"
import { VideoProjectType } from "./dto/video-project.type"

@Resolver()
/** GraphQL door of videoProject. */
export class GetVideoProjectResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** videoProject in the caller's checked workspace. */
    @Query(() => VideoProjectType, { name: "videoProject" })
    async videoProject(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: GetVideoProjectInput,
    ): Promise<VideoProjectType> {
        const result = await this.queryBus.execute(
            new GetVideoProjectQuery({ request: toGetVideoProjectRequest(workspaceId, input), principal }),
        )
        return toGetVideoProjectType(result)
    }
}
