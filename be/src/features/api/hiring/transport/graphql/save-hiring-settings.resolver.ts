import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveHiringSettingsCommand } from "../../application/save-hiring-settings.command"
import { HiringSettingsType } from "./dto/hiring-settings.type"
import { SaveHiringSettingsInput } from "./dto/save-hiring-settings.input"
import { toSaveHiringSettingsRequest, toHiringSettingsType } from "./hiring-jobs.mapper"

@Resolver()
/** GraphQL door: change the hiring settings. */
export class SaveHiringSettingsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Change the hiring settings. */
    @Mutation(() => HiringSettingsType, { name: "saveHiringSettings" })
    async saveHiringSettings(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveHiringSettingsInput,
    ): Promise<HiringSettingsType> {
        const result = await this.commandBus.execute(
            new SaveHiringSettingsCommand({ request: toSaveHiringSettingsRequest(workspaceId, input), principal }),
        )
        return toHiringSettingsType(result, workspaceId)
    }
}
