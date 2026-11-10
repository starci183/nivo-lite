import { QueryHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import type { ProviderBoard } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListProviderRightsQuery } from "./list-provider-rights.query"

@QueryHandler(ListProviderRightsQuery)
/** Asks for the rights board: every provider with its abilities, and every attachment of the workspace. The admin service checks the owner or manager role. */
export class ListProviderRightsHandler extends ICQRSHandler<ListProviderRightsQuery, ProviderBoard> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(query: ListProviderRightsQuery): Promise<ProviderBoard> {
        return this.admin.providerBoard({
            principalId: query.params.principal.id,
            workspaceId: query.params.request.workspaceId,
        })
    }
}
