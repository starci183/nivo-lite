import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ApproveMcpConnectorCommand } from "./approve-mcp-connector.command"

@CommandHandler(ApproveMcpConnectorCommand)
/** Approves the live tool catalog of a remote connector. The admin service checks the owner or manager role. */
export class ApproveMcpConnectorHandler extends ICQRSHandler<ApproveMcpConnectorCommand, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: ApproveMcpConnectorCommand): Promise<number> {
        return this.admin.approveCatalog(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.key,
        )
    }
}
