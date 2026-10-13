import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptInviteCommand } from "../../application/accept-invite.command"
import { AcceptInviteType } from "./dto/accept-invite.type"
import { InviteTokenInput } from "./dto/invite-token.input"
import { toAcceptInviteRequest, toAcceptInviteType } from "./accept-invite.mapper"

@Resolver()
/** GraphQL door of accepting an invitation. */
export class AcceptInviteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Joins the caller to the invited workspace when the signed-in address matches the invitation. */
    @Mutation(() => AcceptInviteType, { name: "acceptInvite" })
    async acceptInvite(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: InviteTokenInput,
    ): Promise<AcceptInviteType> {
        const result = await this.commandBus.execute(
            new AcceptInviteCommand({ request: toAcceptInviteRequest(input), principal }),
        )
        return toAcceptInviteType(result)
    }
}
