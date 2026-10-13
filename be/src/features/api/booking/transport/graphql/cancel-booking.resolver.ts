import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CancelBookingCommand } from "../../application/cancel-booking.command"
import { toCancelBookingRequest, toCancelBookingType } from "./cancel-booking.mapper"
import { CancelBookingInput } from "./dto/cancel-booking.input"
import { CancelBookingType } from "./dto/cancel-booking.type"

@Resolver()
/** GraphQL door for cancel booking. */
export class CancelBookingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies cancel booking for the selected workspace. */
    @Mutation(() => CancelBookingType, { name: "cancelBooking" })
    async cancelBooking(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CancelBookingInput,
    ): Promise<CancelBookingType> {
        const result = await this.commandBus.execute(
            new CancelBookingCommand({ request: toCancelBookingRequest(workspaceId, input), principal }),
        )
        return toCancelBookingType(result)
    }
}
