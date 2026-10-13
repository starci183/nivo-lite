import { CommandHandler } from "@nestjs/cqrs"
import { AdminSupportService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SetWorkspaceStatusResult } from "./set-workspace-status.contracts"
import { SetWorkspaceStatusCommand } from "./set-workspace-status.command"

@CommandHandler(SetWorkspaceStatusCommand)
/** Marks a workspace active or past due. */
export class SetWorkspaceStatusHandler extends ICQRSHandler<SetWorkspaceStatusCommand, SetWorkspaceStatusResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminSupportService: AdminSupportService,
    ) {
        super(logger)
    }

    protected override process(command: SetWorkspaceStatusCommand): Promise<SetWorkspaceStatusResult> {
        return this.adminSupportService.setStatus(
            command.params.principal,
            command.params.request.workspaceId,
            command.params.request.status,
        )
    }
}
