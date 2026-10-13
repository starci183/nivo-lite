import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveBookingServiceCommand } from "../../application/remove-booking-service.command"
import { toRemoveBookingServiceRequest, toRemoveBookingServiceType } from "./remove-booking-service.mapper"
import { RemoveBookingServiceInput } from "./dto/remove-booking-service.input"
import { RemoveBookingServiceType } from "./dto/remove-booking-service.type"

@Resolver()
/** GraphQL door for remove booking service. */
export class RemoveBookingServiceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies remove booking service for the selected workspace. */
    @Mutation(() => RemoveBookingServiceType, { name: "removeBookingService" })
    async removeBookingService(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RemoveBookingServiceInput,
    ): Promise<RemoveBookingServiceType> {
        const result = await this.commandBus.execute(
            new RemoveBookingServiceCommand({ request: toRemoveBookingServiceRequest(workspaceId, input), principal }),
        )
        return toRemoveBookingServiceType(result)
    }
}
