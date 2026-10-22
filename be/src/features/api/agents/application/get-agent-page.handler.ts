import { QueryHandler } from "@nestjs/cqrs"
import { AgentProfileService } from "@modules/domain/agent-profile"
import type { AgentPage } from "@modules/domain/agent-profile"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentPageQuery } from "./get-agent-page.query"

@QueryHandler(GetAgentPageQuery)
/** Answers the profile page of an agent from the agent profile service. */
export class GetAgentPageHandler extends ICQRSHandler<GetAgentPageQuery, AgentPage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly profiles: AgentProfileService,
    ) {
        super(logger)
    }

    protected override process(query: GetAgentPageQuery): Promise<AgentPage> {
        return this.profiles.page(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.agentId,
        )
    }
}
