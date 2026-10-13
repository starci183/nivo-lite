import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveShiftsAvailabilityCommand } from "../../application/remove-shifts-availability.command"
import { ShiftsAvailabilityRefInput } from "./dto/shifts-availability-ref.input"
import { toRemoveShiftsAvailabilityRequest } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: remove an availability statement. */
export class RemoveShiftsAvailabilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Remove an availability statement. */
    @Mutation(() => Boolean, { name: "removeShiftsAvailability" })
    async removeShiftsAvailability(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ShiftsAvailabilityRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new RemoveShiftsAvailabilityCommand({
                request: toRemoveShiftsAvailabilityRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
