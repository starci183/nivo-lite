import { QueryHandler } from "@nestjs/cqrs"
import { NodeRightRollupsService, type AgentNodeRights } from "@modules/domain/node-right-rollups"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { GetAgentNodeRightsQuery } from "./get-agent-node-rights.query"

@QueryHandler(GetAgentNodeRightsQuery)
/** The rights page of one agent: its attached accounts and what its running workflow nodes call on them. The capability proves the member. */
export class GetAgentNodeRightsHandler extends ICQRSHandler<GetAgentNodeRightsQuery, AgentNodeRights> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rollups: NodeRightRollupsService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentNodeRightsQuery): Promise<AgentNodeRights> {
        return this.rollups.agentRights(
            { principalId: query.params.principal.id, workspaceId: query.params.request.workspaceId },
            query.params.request.agentId,
        )
    }
}
