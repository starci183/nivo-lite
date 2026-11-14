import { CommandHandler } from "@nestjs/cqrs"
import { MyInvitesService } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { DeclineInviteCommand } from "./decline-invite.command"

@CommandHandler(DeclineInviteCommand)
/** Declines the invitation through the invites service. */
export class DeclineInviteHandler extends ICQRSHandler<DeclineInviteCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: MyInvitesService,
    ) {
        super(logger)
    }

    protected override process(command: DeclineInviteCommand): Promise<void> {
        return this.invites.decline(command.params.principal, command.params.request.inviteId)
    }
}
