import { QueryHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import type { ConnectorView } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListMcpConnectorsQuery } from "./list-mcp-connectors.query"

@QueryHandler(ListMcpConnectorsQuery)
/** Asks for the gateway connectors of the workspace with their tools. The admin service checks the owner or manager role. */
export class ListMcpConnectorsHandler extends ICQRSHandler<ListMcpConnectorsQuery, ReadonlyArray<ConnectorView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(query: ListMcpConnectorsQuery): Promise<ReadonlyArray<ConnectorView>> {
        return this.admin.connectors({
            principalId: query.params.principal.id,
            workspaceId: query.params.request.workspaceId,
        })
    }
}
