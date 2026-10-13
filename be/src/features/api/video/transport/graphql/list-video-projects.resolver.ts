import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListVideoProjectsQuery } from "../../application/list-video-projects.query"
import { toListVideoProjectsRequest, toListVideoProjectsType } from "./list-video-projects.mapper"
import { ListVideoProjectsInput } from "./dto/list-video-projects.input"
import { VideoProjectType } from "./dto/video-project.type"

@Resolver()
/** GraphQL door of videoProjects. */
export class ListVideoProjectsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** videoProjects in the caller's checked workspace. */
    @Query(() => [VideoProjectType], { name: "videoProjects" })
    async videoProjects(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListVideoProjectsInput,
    ): Promise<Array<VideoProjectType>> {
        const result = await this.queryBus.execute(
            new ListVideoProjectsQuery({ request: toListVideoProjectsRequest(workspaceId, input), principal }),
        )
        return toListVideoProjectsType(result)
    }
}
