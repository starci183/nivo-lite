import { QueryHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import type { TemplateCandidate } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListProviderTemplateCandidatesQuery } from "./list-provider-template-candidates.query"

@QueryHandler(ListProviderTemplateCandidatesQuery)
/** Asks which agents a template would attach to a provider connected after they were created. The admin service checks the owner or manager role. */
export class ListProviderTemplateCandidatesHandler extends ICQRSHandler<
    ListProviderTemplateCandidatesQuery,
    ReadonlyArray<TemplateCandidate>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(query: ListProviderTemplateCandidatesQuery): Promise<ReadonlyArray<TemplateCandidate>> {
        return this.admin.templateCandidates(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.connectionId,
        )
    }
}
