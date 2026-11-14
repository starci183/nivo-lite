import { CommandHandler } from "@nestjs/cqrs"
import { MyInvitesService, type AcceptedInvite } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { JoinInviteCommand } from "./join-invite.command"

@CommandHandler(JoinInviteCommand)
/** Accepts the invitation by its id through the invites service. */
export class JoinInviteHandler extends ICQRSHandler<JoinInviteCommand, AcceptedInvite> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: MyInvitesService,
    ) {
        super(logger)
    }

    protected override process(command: JoinInviteCommand): Promise<AcceptedInvite> {
        return this.invites.join(command.params.principal, command.params.request.inviteId)
    }
}
