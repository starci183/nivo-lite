import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListVideoMediaQuery } from "../../application/list-video-media.query"
import { toListVideoMediaRequest, toListVideoMediaType } from "./list-video-media.mapper"
import { VideoMediaType } from "./dto/video-media.type"

@Resolver()
/** GraphQL door of videoMedia. */
export class ListVideoMediaResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** videoMedia in the caller's checked workspace. */
    @Query(() => [VideoMediaType], { name: "videoMedia" })
    async videoMedia(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<VideoMediaType>> {
        const result = await this.queryBus.execute(
            new ListVideoMediaQuery({ request: toListVideoMediaRequest(workspaceId), principal }),
        )
        return toListVideoMediaType(result)
    }
}
