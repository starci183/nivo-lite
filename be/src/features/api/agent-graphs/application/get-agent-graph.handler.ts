import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import { AiWorkUsageService } from "@modules/domain/ai-usage-events"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AgentGraphRead } from "./get-agent-graph.contracts"
import { GetAgentGraphQuery } from "./get-agent-graph.query"
import { graphAiNodesOf } from "./graph-ai-nodes.policy"

/** The days the model use of each AI node covers. */
export const AI_WINDOW_DAYS = 7

/** One day, milliseconds. */
const DAY_MS = 86_400_000

@QueryHandler(GetAgentGraphQuery)
/**
 * Opens the graph of one agent for the editor, seeding it on the first open, with the model and the credits of each AI node over the
 * last 7 days (one grouped read for the whole graph). The admin service checks the owner or manager role BEFORE the usage is read.
 */
export class GetAgentGraphHandler extends ICQRSHandler<GetAgentGraphQuery, AgentGraphRead> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly admin: AgentGraphAdminService,
        private readonly usage: AiWorkUsageService,
    ) {
        super(logger)
    }

    protected override async process(command: GetAgentGraphQuery): Promise<AgentGraphRead> {
        const { workspaceId, agentId, locale } = command.params.request
        const graph = await this.admin.open({ workspaceId, principalId: command.params.principal.id }, agentId, locale)
        const since = new Date(this.clock.now().getTime() - AI_WINDOW_DAYS * DAY_MS)
        const steps = await this.usage.agentSteps(workspaceId, graph.agentId, since)
        return { ...graph, aiNodes: graphAiNodesOf(graph.draftJson, steps), aiWindowDays: AI_WINDOW_DAYS }
    }
}
