import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MarkVideoPublishedCommand } from "../../application/mark-video-published.command"
import { toMarkVideoPublishedRequest, toMarkVideoPublishedType } from "./mark-video-published.mapper"
import { MarkVideoPublishedInput } from "./dto/mark-video-published.input"
import { VideoProjectType } from "./dto/video-project.type"

@Resolver()
/** GraphQL door of markVideoPublished. */
export class MarkVideoPublishedResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** markVideoPublished in the caller's checked workspace. */
    @Mutation(() => VideoProjectType, { name: "markVideoPublished" })
    async markVideoPublished(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MarkVideoPublishedInput,
    ): Promise<VideoProjectType> {
        const result = await this.commandBus.execute(
            new MarkVideoPublishedCommand({ request: toMarkVideoPublishedRequest(workspaceId, input), principal }),
        )
        return toMarkVideoPublishedType(result)
    }
}
