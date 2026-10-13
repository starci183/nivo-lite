import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CheckInBookingCommand } from "../../application/check-in-booking.command"
import { toCheckInBookingRequest, toCheckInBookingType } from "./check-in-booking.mapper"
import { CheckInBookingInput } from "./dto/check-in-booking.input"
import { CheckInBookingType } from "./dto/check-in-booking.type"

@Resolver()
/** GraphQL door for check in booking. */
export class CheckInBookingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies check in booking for the selected workspace. */
    @Mutation(() => CheckInBookingType, { name: "checkInBooking" })
    async checkInBooking(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CheckInBookingInput,
    ): Promise<CheckInBookingType> {
        const result = await this.commandBus.execute(
            new CheckInBookingCommand({ request: toCheckInBookingRequest(workspaceId, input), principal }),
        )
        return toCheckInBookingType(result)
    }
}
