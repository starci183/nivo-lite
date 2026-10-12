import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import type { InviteResult } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CopyInviteLinkCommand } from "./copy-invite-link.command"

@CommandHandler(CopyInviteLinkCommand)
/** Issues the fresh link through the invites service. */
export class CopyInviteLinkHandler extends ICQRSHandler<CopyInviteLinkCommand, InviteResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: WorkspaceInvitesService,
    ) {
        super(logger)
    }

    protected override process(command: CopyInviteLinkCommand): Promise<InviteResult> {
        return this.invites.copyLink(command.params.principal.id, command.params.request.workspaceId, command.params.request.inviteId)
    }
}
