import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetVideoScriptStatusQuery } from "../../application/get-video-script-status.query"
import { toGetVideoScriptStatusRequest, toVideoScriptStatusType } from "./video-script-status.mapper"
import { VideoScriptStatusInput } from "./dto/video-script-status.input"
import { VideoScriptStatusType } from "./dto/video-script-status.type"

@Resolver()
/** Read-only GraphQL door for a queued script operation. */
export class VideoScriptStatusResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads progress without running or settling the job. */
    @Query(() => VideoScriptStatusType, { name: "videoScriptStatus" })
    async videoScriptStatus(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: VideoScriptStatusInput,
    ): Promise<VideoScriptStatusType> {
        const result = await this.queryBus.execute(
            new GetVideoScriptStatusQuery({ request: toGetVideoScriptStatusRequest(input, workspaceId), principal }),
        )
        return toVideoScriptStatusType(result)
    }
}
