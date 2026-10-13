import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CompleteBookingCommand } from "../../application/complete-booking.command"
import { toCompleteBookingRequest, toCompleteBookingType } from "./complete-booking.mapper"
import { CompleteBookingInput } from "./dto/complete-booking.input"
import { CompleteBookingType } from "./dto/complete-booking.type"

@Resolver()
/** GraphQL door for complete booking. */
export class CompleteBookingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies complete booking for the selected workspace. */
    @Mutation(() => CompleteBookingType, { name: "completeBooking" })
    async completeBooking(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CompleteBookingInput,
    ): Promise<CompleteBookingType> {
        const result = await this.commandBus.execute(
            new CompleteBookingCommand({ request: toCompleteBookingRequest(workspaceId, input), principal }),
        )
        return toCompleteBookingType(result)
    }
}
