import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AddBookingCommand } from "../../application/add-booking.command"
import { toAddBookingRequest, toAddBookingType } from "./add-booking.mapper"
import { AddBookingInput } from "./dto/add-booking.input"
import { AddBookingType } from "./dto/add-booking.type"

@Resolver()
/** GraphQL door for add booking. */
export class AddBookingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies add booking for the selected workspace. */
    @Mutation(() => AddBookingType, { name: "addBooking" })
    async addBooking(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AddBookingInput,
    ): Promise<AddBookingType> {
        const result = await this.commandBus.execute(
            new AddBookingCommand({ request: toAddBookingRequest(workspaceId, input), principal }),
        )
        return toAddBookingType(result)
    }
}
