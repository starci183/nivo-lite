import { QueryHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import type { GrantView } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListMcpToolGrantsQuery } from "./list-mcp-tool-grants.query"

@QueryHandler(ListMcpToolGrantsQuery)
/** Asks for every agent's tool grants. The admin service checks the owner or manager role. */
export class ListMcpToolGrantsHandler extends ICQRSHandler<ListMcpToolGrantsQuery, ReadonlyArray<GrantView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(query: ListMcpToolGrantsQuery): Promise<ReadonlyArray<GrantView>> {
        return this.admin.grants({
            principalId: query.params.principal.id,
            workspaceId: query.params.request.workspaceId,
        })
    }
}
