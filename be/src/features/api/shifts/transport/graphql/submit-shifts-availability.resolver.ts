import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SubmitShiftsAvailabilityCommand } from "../../application/submit-shifts-availability.command"
import { ShiftsRefType } from "./dto/shifts-ref.type"
import { SaveShiftsAvailabilityInput } from "./dto/save-shifts-availability.input"
import { toSubmitShiftsAvailabilityRequest, toShiftsRefType } from "./shifts-setup.mapper"

@Resolver()
/** GraphQL door: file the caller's own availability statement, waiting for approval. */
export class SubmitShiftsAvailabilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** File the caller's own availability statement, waiting for approval. */
    @Mutation(() => ShiftsRefType, { name: "submitShiftsAvailability" })
    async submitShiftsAvailability(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveShiftsAvailabilityInput,
    ): Promise<ShiftsRefType> {
        const result = await this.commandBus.execute(
            new SubmitShiftsAvailabilityCommand({
                request: toSubmitShiftsAvailabilityRequest(workspaceId, input),
                principal,
            }),
        )
        return toShiftsRefType(result)
    }
}
