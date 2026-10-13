import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveBookingPolicyCommand } from "../../application/save-booking-policy.command"
import { toSaveBookingPolicyRequest, toSaveBookingPolicyType } from "./save-booking-policy.mapper"
import { SaveBookingPolicyInput } from "./dto/save-booking-policy.input"
import { SaveBookingPolicyType } from "./dto/save-booking-policy.type"

@Resolver()
/** GraphQL door for save booking policy. */
export class SaveBookingPolicyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies save booking policy for the selected workspace. */
    @Mutation(() => SaveBookingPolicyType, { name: "saveBookingPolicy" })
    async saveBookingPolicy(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveBookingPolicyInput,
    ): Promise<SaveBookingPolicyType> {
        const result = await this.commandBus.execute(
            new SaveBookingPolicyCommand({ request: toSaveBookingPolicyRequest(workspaceId, input), principal }),
        )
        return toSaveBookingPolicyType(result)
    }
}
