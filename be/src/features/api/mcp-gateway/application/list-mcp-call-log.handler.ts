import { QueryHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import type { CallLogView } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListMcpCallLogQuery } from "./list-mcp-call-log.query"

@QueryHandler(ListMcpCallLogQuery)
/** Asks for the latest gateway audit lines (secrets masked). The admin service checks the owner or manager role. */
export class ListMcpCallLogHandler extends ICQRSHandler<ListMcpCallLogQuery, ReadonlyArray<CallLogView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(query: ListMcpCallLogQuery): Promise<ReadonlyArray<CallLogView>> {
        return this.admin.callLog({
            actor: { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            limit: query.params.request.limit,
        })
    }
}
