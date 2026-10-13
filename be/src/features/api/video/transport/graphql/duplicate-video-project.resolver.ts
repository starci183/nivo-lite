import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DuplicateVideoProjectCommand } from "../../application/duplicate-video-project.command"
import { toDuplicateVideoProjectRequest, toDuplicateVideoProjectType } from "./duplicate-video-project.mapper"
import { DuplicateVideoProjectInput } from "./dto/duplicate-video-project.input"
import { VideoProjectType } from "./dto/video-project.type"

@Resolver()
/** GraphQL door of duplicateVideoProject. */
export class DuplicateVideoProjectResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** duplicateVideoProject in the caller's checked workspace. */
    @Mutation(() => VideoProjectType, { name: "duplicateVideoProject" })
    async duplicateVideoProject(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DuplicateVideoProjectInput,
    ): Promise<VideoProjectType> {
        const result = await this.commandBus.execute(
            new DuplicateVideoProjectCommand({
                request: toDuplicateVideoProjectRequest(workspaceId, input),
                principal,
            }),
        )
        return toDuplicateVideoProjectType(result)
    }
}
