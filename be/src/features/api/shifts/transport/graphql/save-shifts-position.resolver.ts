import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveShiftsPositionCommand } from "../../application/save-shifts-position.command"
import { ShiftsRefType } from "./dto/shifts-ref.type"
import { SaveShiftsPositionInput } from "./dto/save-shifts-position.input"
import { toSaveShiftsPositionRequest, toShiftsRefType } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: create or update one position. */
export class SaveShiftsPositionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Create or update one position. */
    @Mutation(() => ShiftsRefType, { name: "saveShiftsPosition" })
    async saveShiftsPosition(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveShiftsPositionInput,
    ): Promise<ShiftsRefType> {
        const result = await this.commandBus.execute(
            new SaveShiftsPositionCommand({ request: toSaveShiftsPositionRequest(workspaceId, input), principal }),
        )
        return toShiftsRefType(result)
    }
}
