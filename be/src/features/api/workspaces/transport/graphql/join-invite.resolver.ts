import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { JoinInviteCommand } from "../../application/join-invite.command"
import { toAcceptInviteType } from "./accept-invite.mapper"
import { AcceptInviteType } from "./dto/accept-invite.type"
import { InviteRefInput } from "./dto/invite-ref.input"
import { toMyInviteRequest } from "./my-invites.mapper"

@Resolver()
/** GraphQL door of joining a workspace from an invitation addressed to the caller. */
export class JoinInviteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Accepts, by its id, a pending invitation addressed to the caller's signed-in email. */
    @Mutation(() => AcceptInviteType, { name: "joinInvite" })
    async joinInvite(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: InviteRefInput,
    ): Promise<AcceptInviteType> {
        const result = await this.commandBus.execute(
            new JoinInviteCommand({ request: toMyInviteRequest(input), principal }),
        )
        return toAcceptInviteType(result)
    }
}
