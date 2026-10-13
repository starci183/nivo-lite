import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveShiftsSettingsCommand } from "../../application/save-shifts-settings.command"
import { SaveShiftsSettingsInput } from "./dto/save-shifts-settings.input"
import { toSaveShiftsSettingsRequest } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: save the notice, reminder and overtime rules. */
export class SaveShiftsSettingsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Save the notice, reminder and overtime rules. */
    @Mutation(() => Boolean, { name: "saveShiftsSettings" })
    async saveShiftsSettings(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveShiftsSettingsInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new SaveShiftsSettingsCommand({ request: toSaveShiftsSettingsRequest(workspaceId, input), principal }),
        )
        return true
    }
}
