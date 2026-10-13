import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveVideoBrandCommand } from "../../application/save-video-brand.command"
import { toSaveVideoBrandRequest, toSaveVideoBrandType } from "./save-video-brand.mapper"
import { SaveVideoBrandInput } from "./dto/save-video-brand.input"
import { VideoBrandType } from "./dto/video-brand.type"

@Resolver()
/** GraphQL door of saveVideoBrand. */
export class SaveVideoBrandResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** saveVideoBrand in the caller's checked workspace. */
    @Mutation(() => VideoBrandType, { name: "saveVideoBrand" })
    async saveVideoBrand(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveVideoBrandInput,
    ): Promise<VideoBrandType> {
        const result = await this.commandBus.execute(
            new SaveVideoBrandCommand({ request: toSaveVideoBrandRequest(workspaceId, input), principal }),
        )
        return toSaveVideoBrandType(result)
    }
}
