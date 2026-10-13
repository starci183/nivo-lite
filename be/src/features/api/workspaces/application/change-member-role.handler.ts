import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChangeMemberRoleCommand } from "./change-member-role.command"

@CommandHandler(ChangeMemberRoleCommand)
/** Changes the role through the members service. */
export class ChangeMemberRoleHandler extends ICQRSHandler<ChangeMemberRoleCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {
        super(logger)
    }

    protected override process(command: ChangeMemberRoleCommand): Promise<void> {
        return this.members.changeRole(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.userId,
            command.params.request.role,
        )
    }
}
