import { Injectable } from "@nestjs/common"
import { AiWorkUsageService } from "@modules/domain/ai-usage-events"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { AgentGraphRead } from "./agent-graph-read.contracts"
import type { OptionalText } from "./agent-pages.contracts"
import { graphAiNodesOf } from "./graph-ai-nodes.policy"

/** The days the model use of each AI node covers. */
const AI_WINDOW_DAYS = 7

/** One day, milliseconds. */
const DAY_MS = 86_400_000

@Injectable()
/**
 * Opens the graph of one agent for the editor, seeding it on the first open, with the model and the credits of each AI node over the
 * last 7 days (one grouped read for the whole graph). The admin service checks the owner or manager role BEFORE the usage is read.
 */
export class AgentGraphReadService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly admin: AgentGraphAdminService,
        private readonly usage: AiWorkUsageService,
    ) {}

    /** The graph of the agent for the editor, with the model use of each AI node over the window. */
    async open(userId: string, workspaceId: string, agentId: string, locale: OptionalText): Promise<AgentGraphRead> {
        const graph = await this.admin.open({ workspaceId, principalId: userId }, agentId, locale)
        const since = new Date(this.clock.now().getTime() - AI_WINDOW_DAYS * DAY_MS)
        const steps = await this.usage.agentSteps(workspaceId, graph.agentId, since)
        return { ...graph, aiNodes: graphAiNodesOf(graph.draftJson, steps), aiWindowDays: AI_WINDOW_DAYS }
    }
}
