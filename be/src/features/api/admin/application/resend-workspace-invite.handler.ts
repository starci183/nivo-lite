import { CommandHandler } from "@nestjs/cqrs"
import { AdminSupportService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ResendWorkspaceInviteResult } from "./resend-workspace-invite.contracts"
import { ResendWorkspaceInviteCommand } from "./resend-workspace-invite.command"

@CommandHandler(ResendWorkspaceInviteCommand)
/** Reissues a pending invitation of a workspace and sends the email again. */
export class ResendWorkspaceInviteHandler extends ICQRSHandler<
    ResendWorkspaceInviteCommand,
    ResendWorkspaceInviteResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminSupportService: AdminSupportService,
    ) {
        super(logger)
    }

    protected override process(command: ResendWorkspaceInviteCommand): Promise<ResendWorkspaceInviteResult> {
        return this.adminSupportService.resendInvite(
            command.params.principal,
            command.params.request.workspaceId,
            command.params.request.inviteId,
        )
    }
}
