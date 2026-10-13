import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { MoveBookingCommand } from "../../application/move-booking.command"
import { toMoveBookingRequest, toMoveBookingType } from "./move-booking.mapper"
import { MoveBookingInput } from "./dto/move-booking.input"
import { MoveBookingType } from "./dto/move-booking.type"

@Resolver()
/** GraphQL door for move booking. */
export class MoveBookingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies move booking for the selected workspace. */
    @Mutation(() => MoveBookingType, { name: "moveBooking" })
    async moveBooking(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: MoveBookingInput,
    ): Promise<MoveBookingType> {
        const result = await this.commandBus.execute(
            new MoveBookingCommand({ request: toMoveBookingRequest(workspaceId, input), principal }),
        )
        return toMoveBookingType(result)
    }
}
