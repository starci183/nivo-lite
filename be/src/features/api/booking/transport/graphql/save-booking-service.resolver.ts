import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveBookingServiceCommand } from "../../application/save-booking-service.command"
import { toSaveBookingServiceRequest, toSaveBookingServiceType } from "./save-booking-service.mapper"
import { SaveBookingServiceInput } from "./dto/save-booking-service.input"
import { SaveBookingServiceType } from "./dto/save-booking-service.type"

@Resolver()
/** GraphQL door for save booking service. */
export class SaveBookingServiceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies save booking service for the selected workspace. */
    @Mutation(() => SaveBookingServiceType, { name: "saveBookingService" })
    async saveBookingService(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveBookingServiceInput,
    ): Promise<SaveBookingServiceType> {
        const result = await this.commandBus.execute(
            new SaveBookingServiceCommand({ request: toSaveBookingServiceRequest(workspaceId, input), principal }),
        )
        return toSaveBookingServiceType(result)
    }
}
