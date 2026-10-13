import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateVideoProjectCommand } from "../../application/update-video-project.command"
import { toUpdateVideoProjectRequest, toUpdateVideoProjectType } from "./update-video-project.mapper"
import { UpdateVideoProjectInput } from "./dto/update-video-project.input"
import { VideoProjectType } from "./dto/video-project.type"

@Resolver()
/** GraphQL door of updateVideoProject. */
export class UpdateVideoProjectResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** updateVideoProject in the caller's checked workspace. */
    @Mutation(() => VideoProjectType, { name: "updateVideoProject" })
    async updateVideoProject(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdateVideoProjectInput,
    ): Promise<VideoProjectType> {
        const result = await this.commandBus.execute(
            new UpdateVideoProjectCommand({ request: toUpdateVideoProjectRequest(workspaceId, input), principal }),
        )
        return toUpdateVideoProjectType(result)
    }
}
