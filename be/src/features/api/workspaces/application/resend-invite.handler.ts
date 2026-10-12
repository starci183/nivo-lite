import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import type { InviteResult } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ResendInviteCommand } from "./resend-invite.command"

@CommandHandler(ResendInviteCommand)
/** Resends the invitation through the invites service. */
export class ResendInviteHandler extends ICQRSHandler<ResendInviteCommand, InviteResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: WorkspaceInvitesService,
    ) {
        super(logger)
    }

    protected override process(command: ResendInviteCommand): Promise<InviteResult> {
        return this.invites.resend(command.params.principal.id, command.params.request.workspaceId, command.params.request.inviteId)
    }
}
