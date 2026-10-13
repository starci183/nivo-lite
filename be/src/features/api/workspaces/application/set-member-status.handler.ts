import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetMemberStatusCommand } from "./set-member-status.command"

@CommandHandler(SetMemberStatusCommand)
/** Enables or disables the member through the members service. */
export class SetMemberStatusHandler extends ICQRSHandler<SetMemberStatusCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {
        super(logger)
    }

    protected override process(command: SetMemberStatusCommand): Promise<void> {
        return this.members.setStatus(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.userId,
            command.params.request.status,
        )
    }
}
