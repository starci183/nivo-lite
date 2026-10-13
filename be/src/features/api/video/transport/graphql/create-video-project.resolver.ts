import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateVideoProjectCommand } from "../../application/create-video-project.command"
import { toCreateVideoProjectRequest, toCreateVideoProjectType } from "./create-video-project.mapper"
import { CreateVideoProjectInput } from "./dto/create-video-project.input"
import { VideoProjectType } from "./dto/video-project.type"

@Resolver()
/** GraphQL door of createVideoProject. */
export class CreateVideoProjectResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** createVideoProject in the caller's checked workspace. */
    @Mutation(() => VideoProjectType, { name: "createVideoProject" })
    async createVideoProject(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateVideoProjectInput,
    ): Promise<VideoProjectType> {
        const result = await this.commandBus.execute(
            new CreateVideoProjectCommand({ request: toCreateVideoProjectRequest(workspaceId, input), principal }),
        )
        return toCreateVideoProjectType(result)
    }
}
