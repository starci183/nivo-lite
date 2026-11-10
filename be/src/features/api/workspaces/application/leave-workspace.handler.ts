import { CommandHandler } from "@nestjs/cqrs"
import { MemberLobbyService } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeaveWorkspaceCommand } from "./leave-workspace.command"

@CommandHandler(LeaveWorkspaceCommand)
/** Takes the caller's seat out of the workspace through the members lobby service. */
export class LeaveWorkspaceHandler extends ICQRSHandler<LeaveWorkspaceCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly seats: MemberLobbyService,
    ) {
        super(logger)
    }

    protected override process(command: LeaveWorkspaceCommand): Promise<void> {
        return this.seats.leave(command.params.principal.id, command.params.request.workspaceId)
    }
}
