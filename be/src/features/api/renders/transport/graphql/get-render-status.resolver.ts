import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetRenderStatusQuery } from "../../application/get-render-status.query"
import { toGetRenderStatusRequest, toVideoRenderStatusType } from "./get-render-status.mapper"
import { VideoRenderStatusInput } from "./dto/get-render-status.input"
import { VideoRenderStatusType } from "./dto/get-render-status.type"

@Resolver()
/** GraphQL polling door for a workspace's queued render. */
export class VideoRenderStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads progress and output after the application proves the selected workspace membership. */
    @Query(() => VideoRenderStatusType, { name: "videoRenderStatus" })
    async videoRenderStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: VideoRenderStatusInput,
    ): Promise<VideoRenderStatusType> {
        const result = await this.queryBus.execute(
            new GetRenderStatusQuery({ request: toGetRenderStatusRequest(workspaceId, input), principal }),
        )
        return toVideoRenderStatusType(result)
    }
}
