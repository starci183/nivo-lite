import { CommandHandler } from "@nestjs/cqrs"
import { CrmConnectService, type CrmConnectionResult } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SaveCrmConnectionCommand } from "./save-crm-connection.command"

@CommandHandler(SaveCrmConnectionCommand)
/** Saves a CRM connection through the CrmConnectService. */
export class SaveCrmConnectionHandler extends ICQRSHandler<SaveCrmConnectionCommand, CrmConnectionResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly crm: CrmConnectService,
    ) {
        super(logger)
    }

    protected override process(command: SaveCrmConnectionCommand): Promise<CrmConnectionResult> {
        const { request, principal } = command.params
        return this.crm.save(
            { principalId: principal.id, workspaceId: request.workspaceId },
            {
                connectionId: request.connectionId,
                crmId: request.crmId,
                baseUrl: request.baseUrl,
                swaggerUrl: request.swaggerUrl,
                auth: request.auth,
            },
        )
    }
}
