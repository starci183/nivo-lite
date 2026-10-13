import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetVideoFiguresQuery } from "../../application/get-video-figures.query"
import { toGetVideoFiguresRequest, toGetVideoFiguresType } from "./get-video-figures.mapper"
import { VideoFiguresType } from "./dto/video-figures.type"

@Resolver()
/** GraphQL door of videoFigures. */
export class GetVideoFiguresResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** videoFigures in the caller's checked workspace. */
    @Query(() => VideoFiguresType, { name: "videoFigures" })
    async videoFigures(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<VideoFiguresType> {
        const result = await this.queryBus.execute(
            new GetVideoFiguresQuery({ request: toGetVideoFiguresRequest(workspaceId), principal }),
        )
        return toGetVideoFiguresType(result)
    }
}
