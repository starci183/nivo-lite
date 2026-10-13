import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RevokeInviteCommand } from "../../application/revoke-invite.command"
import { InviteRefInput } from "./dto/invite-ref.input"
import { toInviteRefRequest } from "./invite-result.mapper"

@Resolver()
/** GraphQL door of revoking an invitation. */
export class RevokeInviteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Revokes a pending invitation; its link stops working at once. */
    @Mutation(() => Boolean, { name: "revokeInvite" })
    async revokeInvite(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InviteRefInput,
    ): Promise<boolean> {
        await this.commandBus.execute(
            new RevokeInviteCommand({ request: toInviteRefRequest(workspaceId, input), principal }),
        )
        return true
    }
}
