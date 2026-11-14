import { CommandHandler } from "@nestjs/cqrs"
import { AdminEnterpriseService } from "@modules/domain/platform-admin"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { SetWorkspaceEnterpriseKeyResult } from "./set-workspace-enterprise-key.contracts"
import { SetWorkspaceEnterpriseKeyCommand } from "./set-workspace-enterprise-key.command"

@CommandHandler(SetWorkspaceEnterpriseKeyCommand)
/** Sets or clears the enterprise identifier of a workspace, as a platform admin. */
export class SetWorkspaceEnterpriseKeyHandler extends ICQRSHandler<
    SetWorkspaceEnterpriseKeyCommand,
    SetWorkspaceEnterpriseKeyResult
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly adminEnterpriseService: AdminEnterpriseService,
    ) {
        super(logger)
    }

    protected override process(command: SetWorkspaceEnterpriseKeyCommand): Promise<SetWorkspaceEnterpriseKeyResult> {
        return this.adminEnterpriseService.setEnterpriseKey(
            command.params.principal,
            command.params.request.workspaceId,
            command.params.request.enterpriseKey,
        )
    }
}
