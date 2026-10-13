import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AddShiftsAvailabilityCommand } from "../../application/add-shifts-availability.command"
import { ShiftsRefType } from "./dto/shifts-ref.type"
import { SaveShiftsAvailabilityInput } from "./dto/save-shifts-availability.input"
import { toAddShiftsAvailabilityRequest, toShiftsRefType } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: add an availability statement for a person, approved at once. */
export class AddShiftsAvailabilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Add an availability statement for a person, approved at once. */
    @Mutation(() => ShiftsRefType, { name: "addShiftsAvailability" })
    async addShiftsAvailability(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveShiftsAvailabilityInput,
    ): Promise<ShiftsRefType> {
        const result = await this.commandBus.execute(
            new AddShiftsAvailabilityCommand({
                request: toAddShiftsAvailabilityRequest(workspaceId, input),
                principal,
            }),
        )
        return toShiftsRefType(result)
    }
}
