import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveBookingResourceCommand } from "../../application/save-booking-resource.command"
import { toSaveBookingResourceRequest, toSaveBookingResourceType } from "./save-booking-resource.mapper"
import { SaveBookingResourceInput } from "./dto/save-booking-resource.input"
import { SaveBookingResourceType } from "./dto/save-booking-resource.type"

@Resolver()
/** GraphQL door for save booking resource. */
export class SaveBookingResourceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies save booking resource for the selected workspace. */
    @Mutation(() => SaveBookingResourceType, { name: "saveBookingResource" })
    async saveBookingResource(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveBookingResourceInput,
    ): Promise<SaveBookingResourceType> {
        const result = await this.commandBus.execute(
            new SaveBookingResourceCommand({ request: toSaveBookingResourceRequest(workspaceId, input), principal }),
        )
        return toSaveBookingResourceType(result)
    }
}
