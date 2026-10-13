import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ConfirmBookingCommand } from "../../application/confirm-booking.command"
import { toConfirmBookingRequest, toConfirmBookingType } from "./confirm-booking.mapper"
import { ConfirmBookingInput } from "./dto/confirm-booking.input"
import { ConfirmBookingType } from "./dto/confirm-booking.type"

@Resolver()
/** GraphQL door for confirm booking. */
export class ConfirmBookingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies confirm booking for the selected workspace. */
    @Mutation(() => ConfirmBookingType, { name: "confirmBooking" })
    async confirmBooking(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ConfirmBookingInput,
    ): Promise<ConfirmBookingType> {
        const result = await this.commandBus.execute(
            new ConfirmBookingCommand({ request: toConfirmBookingRequest(workspaceId, input), principal }),
        )
        return toConfirmBookingType(result)
    }
}
