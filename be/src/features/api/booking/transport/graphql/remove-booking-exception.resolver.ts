import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveBookingExceptionCommand } from "../../application/remove-booking-exception.command"
import { toRemoveBookingExceptionRequest, toRemoveBookingExceptionType } from "./remove-booking-exception.mapper"
import { RemoveBookingExceptionInput } from "./dto/remove-booking-exception.input"
import { RemoveBookingExceptionType } from "./dto/remove-booking-exception.type"

@Resolver()
/** GraphQL door for remove booking exception. */
export class RemoveBookingExceptionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies remove booking exception for the selected workspace. */
    @Mutation(() => RemoveBookingExceptionType, { name: "removeBookingException" })
    async removeBookingException(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RemoveBookingExceptionInput,
    ): Promise<RemoveBookingExceptionType> {
        const result = await this.commandBus.execute(
            new RemoveBookingExceptionCommand({
                request: toRemoveBookingExceptionRequest(workspaceId, input),
                principal,
            }),
        )
        return toRemoveBookingExceptionType(result)
    }
}
