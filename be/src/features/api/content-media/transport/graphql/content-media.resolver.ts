import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetContentMediaQuery } from "../../application/get-content-media.query"
import { toContentMediaRequest, toContentMediaType } from "./content-media.mapper"
import { ContentMediaInput } from "./dto/content-media.input"
import { ContentMediaType } from "./dto/content-media.type"

@Resolver()
/** GraphQL door of attachable workspace media and short-lived attachment addresses. */
export class ContentMediaResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the workspace library, finished videos and addresses for requested attachments. */
    @Query(() => ContentMediaType, { name: "contentMedia" })
    async contentMedia(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ContentMediaInput,
    ): Promise<ContentMediaType> {
        const result = await this.queryBus.execute(
            new GetContentMediaQuery({ request: toContentMediaRequest(workspaceId, input), principal }),
        )
        return toContentMediaType(result)
    }
}
