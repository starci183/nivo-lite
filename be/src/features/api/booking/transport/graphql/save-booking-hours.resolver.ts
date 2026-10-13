import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveBookingHoursCommand } from "../../application/save-booking-hours.command"
import { toSaveBookingHoursRequest, toSaveBookingHoursType } from "./save-booking-hours.mapper"
import { SaveBookingHoursInput } from "./dto/save-booking-hours.input"
import { SaveBookingHoursType } from "./dto/save-booking-hours.type"

@Resolver()
/** GraphQL door for save booking hours. */
export class SaveBookingHoursResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies save booking hours for the selected workspace. */
    @Mutation(() => SaveBookingHoursType, { name: "saveBookingHours" })
    async saveBookingHours(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveBookingHoursInput,
    ): Promise<SaveBookingHoursType> {
        const result = await this.commandBus.execute(
            new SaveBookingHoursCommand({ request: toSaveBookingHoursRequest(workspaceId, input), principal }),
        )
        return toSaveBookingHoursType(result)
    }
}
