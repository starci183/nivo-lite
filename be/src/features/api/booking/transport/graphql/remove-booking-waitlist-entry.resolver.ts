import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RemoveBookingWaitlistEntryCommand } from "../../application/remove-booking-waitlist-entry.command"
import {
    toRemoveBookingWaitlistEntryRequest,
    toRemoveBookingWaitlistEntryType,
} from "./remove-booking-waitlist-entry.mapper"
import { RemoveBookingWaitlistEntryInput } from "./dto/remove-booking-waitlist-entry.input"
import { RemoveBookingWaitlistEntryType } from "./dto/remove-booking-waitlist-entry.type"

@Resolver()
/** GraphQL door for remove booking waitlist entry. */
export class RemoveBookingWaitlistEntryResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies remove booking waitlist entry for the selected workspace. */
    @Mutation(() => RemoveBookingWaitlistEntryType, { name: "removeBookingWaitlistEntry" })
    async removeBookingWaitlistEntry(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RemoveBookingWaitlistEntryInput,
    ): Promise<RemoveBookingWaitlistEntryType> {
        const result = await this.commandBus.execute(
            new RemoveBookingWaitlistEntryCommand({
                request: toRemoveBookingWaitlistEntryRequest(workspaceId, input),
                principal,
            }),
        )
        return toRemoveBookingWaitlistEntryType(result)
    }
}
