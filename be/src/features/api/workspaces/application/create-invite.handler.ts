import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceInvitesService } from "@modules/domain/workspace-invites"
import type { InviteResult } from "@modules/domain/workspace-invites"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CreateInviteCommand } from "./create-invite.command"

@CommandHandler(CreateInviteCommand)
/** Issues the invitation through the invites service. */
export class CreateInviteHandler extends ICQRSHandler<CreateInviteCommand, InviteResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invites: WorkspaceInvitesService,
    ) {
        super(logger)
    }

    protected override process(command: CreateInviteCommand): Promise<InviteResult> {
        return this.invites.create(command.params.principal.id, command.params.request.workspaceId, command.params.request)
    }
}
