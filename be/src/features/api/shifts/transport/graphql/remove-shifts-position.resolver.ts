import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveShiftsPositionCommand } from "../../application/remove-shifts-position.command"
import { ShiftsPositionRefInput } from "./dto/shifts-position-ref.input"
import { toRemoveShiftsPositionRequest } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: retire a position. */
export class RemoveShiftsPositionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Retire a position. */
    @Mutation(() => Boolean, { name: "removeShiftsPosition" })
    async removeShiftsPosition(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShiftsPositionRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new RemoveShiftsPositionCommand({ request: toRemoveShiftsPositionRequest(workspaceId, input), principal }),
        )
        return true
    }
}
