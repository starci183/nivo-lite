import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SyncMcpConnectorCommand } from "./sync-mcp-connector.command"

@CommandHandler(SyncMcpConnectorCommand)
/** Reads a remote connector's tools/list into its catalog. The admin service checks the owner or manager role. */
export class SyncMcpConnectorHandler extends ICQRSHandler<SyncMcpConnectorCommand, number> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SyncMcpConnectorCommand): Promise<number> {
        return this.admin.syncCatalog(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.key,
        )
    }
}
