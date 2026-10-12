import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import type { AcceptedInvite } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AcceptInviteCommand } from "./accept-invite.command"

@CommandHandler(AcceptInviteCommand)
/** Accepts the invitation through the invites service. */
export class AcceptInviteHandler extends ICQRSHandler<AcceptInviteCommand, AcceptedInvite> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: WorkspaceInvitesService,
    ) {
        super(logger)
    }

    protected override process(command: AcceptInviteCommand): Promise<AcceptedInvite> {
        return this.invites.accept(command.params.principal, command.params.request.token)
    }
}
