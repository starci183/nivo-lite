import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ResendWorkspaceInviteCommand } from "../../application/resend-workspace-invite.command"
import { AdminResendWorkspaceInviteInput } from "./dto/admin-resend-workspace-invite.input"
import { AdminInviteResentType } from "./dto/admin-invite-resent.type"
import { toAdminResendWorkspaceInviteRequest, toAdminInviteResentType } from "./admin-resend-workspace-invite.mapper"

@Resolver()
/** GraphQL door of adminResendWorkspaceInvite. */
export class AdminResendWorkspaceInviteResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Reissues a pending invitation of a workspace and sends the email again. */
    @Mutation(() => AdminInviteResentType, { name: "adminResendWorkspaceInvite" })
    async adminResendWorkspaceInvite(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: AdminResendWorkspaceInviteInput,
    ): Promise<AdminInviteResentType> {
        const result = await this.commandBus.execute(
            new ResendWorkspaceInviteCommand({ request: toAdminResendWorkspaceInviteRequest(input), principal }),
        )
        return toAdminInviteResentType(result)
    }
}
