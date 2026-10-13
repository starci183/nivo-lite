import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RemoveMemberCommand } from "./remove-member.command"

@CommandHandler(RemoveMemberCommand)
/** Removes the member through the members service. */
export class RemoveMemberHandler extends ICQRSHandler<RemoveMemberCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {
        super(logger)
    }

    protected override process(command: RemoveMemberCommand): Promise<void> {
        return this.members.remove(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.userId,
        )
    }
}
