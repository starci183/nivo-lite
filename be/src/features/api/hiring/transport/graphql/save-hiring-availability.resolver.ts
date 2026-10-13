import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveHiringAvailabilityCommand } from "../../application/save-hiring-availability.command"
import { SaveAvailabilityType } from "./dto/save-availability.type"
import { SaveHiringAvailabilityInput } from "./dto/save-hiring-availability.input"
import { toSaveHiringAvailabilityRequest, toSaveAvailabilityType } from "./hiring-interviews.mapper"

@Resolver()
/** GraphQL door: replace the weekly free times of a member. */
export class SaveHiringAvailabilityResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Replace the weekly free times of a member. */
    @Mutation(() => SaveAvailabilityType, { name: "saveHiringAvailability" })
    async saveHiringAvailability(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveHiringAvailabilityInput,
    ): Promise<SaveAvailabilityType> {
        const result = await this.commandBus.execute(
            new SaveHiringAvailabilityCommand({
                request: toSaveHiringAvailabilityRequest(workspaceId, input),
                principal,
            }),
        )
        return toSaveAvailabilityType(result)
    }
}
