import { CommandHandler } from "@nestjs/cqrs"
import type { StaffOption } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SaveStaffCommand } from "./save-staff.command"

@CommandHandler(SaveStaffCommand)
/** Adds or updates a staff row through the workspace members service. */
export class SaveStaffHandler extends ICQRSHandler<SaveStaffCommand, StaffOption> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {
        super(logger)
    }

    protected override process(command: SaveStaffCommand): Promise<StaffOption> {
        return this.members.saveStaff(command.params.principal.id, command.params.request)
    }
}
