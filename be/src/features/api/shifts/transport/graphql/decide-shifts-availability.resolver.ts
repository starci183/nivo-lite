import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { DecideShiftsAvailabilityCommand } from "../../application/decide-shifts-availability.command"
import { DecideShiftsAvailabilityInput } from "./dto/decide-shifts-availability.input"
import { toDecideShiftsAvailabilityRequest } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: approve or decline a pending availability statement. */
export class DecideShiftsAvailabilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approve or decline a pending availability statement. */
    @Mutation(() => Boolean, { name: "decideShiftsAvailability" })
    async decideShiftsAvailability(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DecideShiftsAvailabilityInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new DecideShiftsAvailabilityCommand({
                request: toDecideShiftsAvailabilityRequest(workspaceId, input),
                principal,
            }),
        )
        return true
    }
}
