import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ShareVideoProjectCommand } from "../../application/share-video-project.command"
import { toShareVideoProjectRequest, toShareVideoProjectType } from "./share-video-project.mapper"
import { ShareVideoProjectInput } from "./dto/share-video-project.input"
import { VideoShareType } from "./dto/video-share.type"

@Resolver()
/** GraphQL door of shareVideoProject. */
export class ShareVideoProjectResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** shareVideoProject for an authenticated workspace manager. */
    @Mutation(() => VideoShareType, { name: "shareVideoProject" })
    async shareVideoProject(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShareVideoProjectInput,
    ): Promise<VideoShareType> {
        const result = await this.commandBus.execute(
            new ShareVideoProjectCommand({ request: toShareVideoProjectRequest(workspaceId, input), principal }),
        )
        return toShareVideoProjectType(result)
    }
}
