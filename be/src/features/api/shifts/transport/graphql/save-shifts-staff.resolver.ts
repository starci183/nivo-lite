import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveShiftsStaffCommand } from "../../application/save-shifts-staff.command"
import { ShiftsRefType } from "./dto/shifts-ref.type"
import { SaveShiftsStaffInput } from "./dto/save-shifts-staff.input"
import { toSaveShiftsStaffRequest, toShiftsRefType } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: create or update one person's shifts profile. */
export class SaveShiftsStaffResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or update one person's shifts profile. */
    @Mutation(() => ShiftsRefType, { name: "saveShiftsStaff" })
    async saveShiftsStaff(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveShiftsStaffInput,
    ): Promise<ShiftsRefType> {
        const result = await this.commandBus.execute(
            new SaveShiftsStaffCommand({ request: toSaveShiftsStaffRequest(workspaceId, input), principal }),
        )
        return toShiftsRefType(result)
    }
}
