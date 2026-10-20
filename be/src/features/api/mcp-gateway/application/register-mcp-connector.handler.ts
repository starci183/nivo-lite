import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { actorOf } from "./mcp-gateway.mapper"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RegisterMcpConnectorCommand } from "./register-mcp-connector.command"

@CommandHandler(RegisterMcpConnectorCommand)
/** Registers a remote MCP server as a gateway connector. The admin service checks the owner or manager role. */
export class RegisterMcpConnectorHandler extends ICQRSHandler<RegisterMcpConnectorCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: RegisterMcpConnectorCommand): Promise<void> {
        return this.admin.registerRemote(actorOf(command.params), command.params.request.connector)
    }
}
