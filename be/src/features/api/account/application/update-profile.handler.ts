import { CommandHandler } from "@nestjs/cqrs"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpdateProfileCommand } from "./update-profile.command"

@CommandHandler(UpdateProfileCommand)
/** Carries the display name into every workspace seat of the caller through the members service. */
export class UpdateProfileHandler extends ICQRSHandler<UpdateProfileCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly members: WorkspaceMembersService,
    ) {
        super(logger)
    }

    protected override process(command: UpdateProfileCommand): Promise<void> {
        return this.members.renameSelf(command.params.principal.id, command.params.request.name)
    }
}
