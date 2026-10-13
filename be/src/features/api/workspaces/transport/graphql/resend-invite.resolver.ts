import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ResendInviteCommand } from "../../application/resend-invite.command"
import { InviteResultType } from "./dto/invite-result.type"
import { InviteRefInput } from "./dto/invite-ref.input"
import { toInviteRefRequest, toInviteResultType } from "./invite-result.mapper"

@Resolver()
/** GraphQL door of resending an invitation. */
export class ResendInviteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Emails a pending invitation again with a new link. */
    @Mutation(() => InviteResultType, { name: "resendInvite" })
    async resendInvite(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InviteRefInput,
    ): Promise<InviteResultType> {
        const result = await this.commandBus.execute(
            new ResendInviteCommand({ request: toInviteRefRequest(workspaceId, input), principal }),
        )
        return toInviteResultType(result)
    }
}
