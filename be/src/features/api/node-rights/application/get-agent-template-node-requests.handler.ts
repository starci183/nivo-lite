import { QueryHandler } from "@nestjs/cqrs"
import { NodeRightRollupsService, type TemplateNodeRequests } from "@modules/domain/node-right-rollups"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetAgentTemplateNodeRequestsQuery } from "./get-agent-template-node-requests.query"

@QueryHandler(GetAgentTemplateNodeRequestsQuery)
/** What a workflow template's nodes ask for on accounts, before anything is installed. The capability proves the member. */
export class GetAgentTemplateNodeRequestsHandler extends ICQRSHandler<
    GetAgentTemplateNodeRequestsQuery,
    TemplateNodeRequests
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rollups: NodeRightRollupsService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentTemplateNodeRequestsQuery): Promise<TemplateNodeRequests> {
        return this.rollups.templateRequests(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.templateId,
            query.params.request.version,
        )
    }
}
