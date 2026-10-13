import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveContentCadenceCommand } from "../../application/save-content-cadence.command"
import { toSaveContentCadenceRequest, toSaveContentCadenceType } from "./save-content-cadence.mapper"
import { SaveContentCadenceInput } from "./dto/save-content-cadence.input"
import { SavedContentRowsType } from "./dto/saved-content-rows.type"

@Resolver()
/** GraphQL door of saveContentCadence. */
export class SaveContentCadenceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** saveContentCadence for the selected workspace. */
    @Mutation(() => SavedContentRowsType, { name: "saveContentCadence" })
    async saveContentCadence(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveContentCadenceInput,
    ): Promise<SavedContentRowsType> {
        const result = await this.commandBus.execute(
            new SaveContentCadenceCommand({
                request: toSaveContentCadenceRequest(workspaceId, input),
                principal,
            }),
        )
        return toSaveContentCadenceType(result)
    }
}
