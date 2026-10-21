import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CheckMcpConnectorCommand } from "./check-mcp-connector.command"

@CommandHandler(CheckMcpConnectorCommand)
/** Checks a remote connector's health. The admin service checks the owner or manager role. */
export class CheckMcpConnectorHandler extends ICQRSHandler<CheckMcpConnectorCommand, string> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: CheckMcpConnectorCommand): Promise<string> {
        return this.admin.checkConnector(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.key,
        )
    }
}
