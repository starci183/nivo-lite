import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CopyInviteLinkCommand } from "../../application/copy-invite-link.command"
import { InviteResultType } from "./dto/invite-result.type"
import { InviteRefInput } from "./dto/invite-ref.input"
import { toInviteRefRequest, toInviteResultType } from "./invite-result.mapper"

@Resolver()
/** GraphQL door of copying an invitation link. */
export class CopyInviteLinkResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Issues a fresh link to a pending invitation without emailing it. */
    @Mutation(() => InviteResultType, { name: "copyInviteLink" })
    async copyInviteLink(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InviteRefInput,
    ): Promise<InviteResultType> {
        const result = await this.commandBus.execute(
            new CopyInviteLinkCommand({ request: toInviteRefRequest(workspaceId, input), principal }),
        )
        return toInviteResultType(result)
    }
}
