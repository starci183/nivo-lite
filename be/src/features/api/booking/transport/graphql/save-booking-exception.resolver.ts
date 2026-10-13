import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveBookingExceptionCommand } from "../../application/save-booking-exception.command"
import { toSaveBookingExceptionRequest, toSaveBookingExceptionType } from "./save-booking-exception.mapper"
import { SaveBookingExceptionInput } from "./dto/save-booking-exception.input"
import { SaveBookingExceptionType } from "./dto/save-booking-exception.type"

@Resolver()
/** GraphQL door for save booking exception. */
export class SaveBookingExceptionResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies save booking exception for the selected workspace. */
    @Mutation(() => SaveBookingExceptionType, { name: "saveBookingException" })
    async saveBookingException(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveBookingExceptionInput,
    ): Promise<SaveBookingExceptionType> {
        const result = await this.commandBus.execute(
            new SaveBookingExceptionCommand({ request: toSaveBookingExceptionRequest(workspaceId, input), principal }),
        )
        return toSaveBookingExceptionType(result)
    }
}
