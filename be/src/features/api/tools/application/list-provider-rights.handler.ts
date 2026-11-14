import { QueryHandler } from "@nestjs/cqrs"
import { ToolsConsoleService, type ProviderBoard } from "@modules/domain/tools"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ListProviderRightsQuery } from "./list-provider-rights.query"

@QueryHandler(ListProviderRightsQuery)
/** Asks for the provider board: every provider with its tools and accounts, and every attachment of the workspace. The admin service checks the owner or manager role. */
export class ListProviderRightsHandler extends ICQRSHandler<ListProviderRightsQuery, ProviderBoard> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: ToolsConsoleService,
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
