import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveBookingResourceCommand } from "../../application/remove-booking-resource.command"
import { toRemoveBookingResourceRequest, toRemoveBookingResourceType } from "./remove-booking-resource.mapper"
import { RemoveBookingResourceInput } from "./dto/remove-booking-resource.input"
import { RemoveBookingResourceType } from "./dto/remove-booking-resource.type"

@Resolver()
/** GraphQL door for remove booking resource. */
export class RemoveBookingResourceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies remove booking resource for the selected workspace. */
    @Mutation(() => RemoveBookingResourceType, { name: "removeBookingResource" })
    async removeBookingResource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RemoveBookingResourceInput,
    ): Promise<RemoveBookingResourceType> {
        const result = await this.commandBus.execute(
            new RemoveBookingResourceCommand({
                request: toRemoveBookingResourceRequest(workspaceId, input),
                principal,
            }),
        )
        return toRemoveBookingResourceType(result)
    }
}
