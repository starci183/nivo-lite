import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RevokeInviteCommand } from "./revoke-invite.command"

@CommandHandler(RevokeInviteCommand)
/** Revokes the invitation through the invites service. */
export class RevokeInviteHandler extends ICQRSHandler<RevokeInviteCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: WorkspaceInvitesService,
    ) {
        super(logger)
    }

    protected override process(command: RevokeInviteCommand): Promise<void> {
        return this.invites.revoke(command.params.principal.id, command.params.request.workspaceId, command.params.request.inviteId)
    }
}
