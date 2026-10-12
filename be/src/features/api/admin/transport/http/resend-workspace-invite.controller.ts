import { Controller, Param, ParseUUIDPipe, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ResendWorkspaceInviteCommand } from "../../application/resend-workspace-invite.command"
import { toResendWorkspaceInviteRequest, toResendWorkspaceInviteResponse } from "./resend-workspace-invite.mapper"
import { ResendWorkspaceInviteResponse } from "./dto/resend-workspace-invite.response"

@Controller("admin")
/** HTTP door of resendWorkspaceInvite. */
export class ResendWorkspaceInviteController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Reissues a pending invitation of a workspace and sends the email again. */
    @Post("workspaces/:workspaceId/invites/:inviteId/resend")
    async resendWorkspaceInvite(
        @CurrentPrincipal() principal: Principal,
        @Param("workspaceId", ParseUUIDPipe) workspaceId: string,
        @Param("inviteId", ParseUUIDPipe) inviteId: string,
    ): Promise<ResendWorkspaceInviteResponse> {
        const result = await this.commandBus.execute(
            new ResendWorkspaceInviteCommand({
                request: toResendWorkspaceInviteRequest(workspaceId, inviteId),
                principal,
            }),
        )
        return toResendWorkspaceInviteResponse(result)
    }
}
