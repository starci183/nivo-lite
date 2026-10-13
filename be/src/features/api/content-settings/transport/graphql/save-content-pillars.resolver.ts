import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveContentPillarsCommand } from "../../application/save-content-pillars.command"
import { toSaveContentPillarsRequest, toSaveContentPillarsType } from "./save-content-pillars.mapper"
import { SaveContentPillarsInput } from "./dto/save-content-pillars.input"
import { SavedContentRowsType } from "./dto/saved-content-rows.type"

@Resolver()
/** GraphQL door of saveContentPillars. */
export class SaveContentPillarsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** saveContentPillars for the selected workspace. */
    @Mutation(() => SavedContentRowsType, { name: "saveContentPillars" })
    async saveContentPillars(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveContentPillarsInput,
    ): Promise<SavedContentRowsType> {
        const result = await this.commandBus.execute(
            new SaveContentPillarsCommand({
                request: toSaveContentPillarsRequest(workspaceId, input),
                principal,
            }),
        )
        return toSaveContentPillarsType(result)
    }
}
