import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { DeclineInviteCommand } from "../../application/decline-invite.command"
import { InviteRefInput } from "./dto/invite-ref.input"
import { toMyInviteRequest } from "./my-invites.mapper"

@Resolver()
/** GraphQL door of declining an invitation. */
export class DeclineInviteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Declines a pending invitation addressed to the caller; its link stops working. */
    @Mutation(() => Boolean, { name: "declineInvite" })
    async declineInvite(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: InviteRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(new DeclineInviteCommand({ request: toMyInviteRequest(input), principal }))
        return true
    }
}
