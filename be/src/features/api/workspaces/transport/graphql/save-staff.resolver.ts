import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveStaffCommand } from "../../application/save-staff.command"
import { SaveStaffInput } from "./dto/save-staff.input"
import { StaffOptionType } from "./dto/staff-option.type"
import { toSavedStaffType, toSaveStaffRequest } from "./save-staff.mapper"

@Resolver()
/** GraphQL door that adds or updates a staff row. */
export class SaveStaffResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Adds a staff row, or replaces the named one. Owner and manager only. */
    @Mutation(() => StaffOptionType, { name: "saveStaff" })
    async saveStaff(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveStaffInput,
    ): Promise<StaffOptionType> {
        const result = await this.commandBus.execute(
            new SaveStaffCommand({ request: toSaveStaffRequest(workspaceId, input), principal }),
        )
        return toSavedStaffType(result)
    }
}
