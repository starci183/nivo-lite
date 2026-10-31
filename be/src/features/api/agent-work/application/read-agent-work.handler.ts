import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkDoorsService } from "@modules/domain/agent-work"
import type { AgentWorkView } from "@modules/domain/agent-work"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadAgentWorkQuery } from "./read-agent-work.query"

@QueryHandler(ReadAgentWorkQuery)
/** Answers the work tab of one agent to an owner or manager. */
export class ReadAgentWorkHandler extends ICQRSHandler<ReadAgentWorkQuery, AgentWorkView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly doors: AgentWorkDoorsService,
    ) {
        super(logger)
    }

    protected override process(query: ReadAgentWorkQuery): Promise<AgentWorkView> {
        return this.doors.agentWork(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
        )
    }
}
