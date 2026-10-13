import { CommandHandler } from "@nestjs/cqrs"
import { AdminSupportService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SetWorkspacePlanResult } from "./set-workspace-plan.contracts"
import { SetWorkspacePlanCommand } from "./set-workspace-plan.command"

@CommandHandler(SetWorkspacePlanCommand)
/** Moves a workspace to another plan and sets its own monthly credit allowance. */
export class SetWorkspacePlanHandler extends ICQRSHandler<SetWorkspacePlanCommand, SetWorkspacePlanResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminSupportService: AdminSupportService,
    ) {
        super(logger)
    }

    protected override process(command: SetWorkspacePlanCommand): Promise<SetWorkspacePlanResult> {
        return this.adminSupportService.setPlan(
            command.params.principal,
            command.params.request.workspaceId,
            command.params.request.planCode,
            command.params.request.creditsLimit,
        )
    }
}
