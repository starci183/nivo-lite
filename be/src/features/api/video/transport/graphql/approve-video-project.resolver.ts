import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApproveVideoProjectCommand } from "../../application/approve-video-project.command"
import { toApproveVideoProjectRequest, toApproveVideoProjectType } from "./approve-video-project.mapper"
import { ApproveVideoProjectInput } from "./dto/approve-video-project.input"
import { VideoProjectType } from "./dto/video-project.type"

@Resolver()
/** GraphQL door of approveVideoProject. */
export class ApproveVideoProjectResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** approveVideoProject for an authenticated workspace manager. */
    @Mutation(() => VideoProjectType, { name: "approveVideoProject" })
    async approveVideoProject(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ApproveVideoProjectInput,
    ): Promise<VideoProjectType> {
        const result = await this.commandBus.execute(
            new ApproveVideoProjectCommand({ request: toApproveVideoProjectRequest(workspaceId, input), principal }),
        )
        return toApproveVideoProjectType(result)
    }
}
