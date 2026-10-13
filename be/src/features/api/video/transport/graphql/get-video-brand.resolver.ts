import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetVideoBrandQuery } from "../../application/get-video-brand.query"
import { toGetVideoBrandRequest, toGetVideoBrandType } from "./get-video-brand.mapper"
import { VideoBrandType } from "./dto/video-brand.type"

@Resolver()
/** GraphQL door of videoBrand. */
export class GetVideoBrandResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** videoBrand in the caller's checked workspace. */
    @Query(() => VideoBrandType, { name: "videoBrand" })
    async videoBrand(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<VideoBrandType> {
        const result = await this.queryBus.execute(
            new GetVideoBrandQuery({ request: toGetVideoBrandRequest(workspaceId), principal }),
        )
        return toGetVideoBrandType(result)
    }
}
