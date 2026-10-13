import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ArchiveVideoProjectCommand } from "../../application/archive-video-project.command"
import { toArchiveVideoProjectRequest, toArchiveVideoProjectType } from "./archive-video-project.mapper"
import { ArchiveVideoProjectInput } from "./dto/archive-video-project.input"
import { VideoProjectType } from "./dto/video-project.type"

@Resolver()
/** GraphQL door of archiveVideoProject. */
export class ArchiveVideoProjectResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** archiveVideoProject in the caller's checked workspace. */
    @Mutation(() => VideoProjectType, { name: "archiveVideoProject" })
    async archiveVideoProject(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ArchiveVideoProjectInput,
    ): Promise<VideoProjectType> {
        const result = await this.commandBus.execute(
            new ArchiveVideoProjectCommand({ request: toArchiveVideoProjectRequest(workspaceId, input), principal }),
        )
        return toArchiveVideoProjectType(result)
    }
}
