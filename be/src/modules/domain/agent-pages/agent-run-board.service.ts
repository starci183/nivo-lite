import { Injectable } from "@nestjs/common"
import { AgentRunsLimitService, AgentRunsViewService } from "@modules/domain/agent-runs"
import { AiUsageEventsService } from "@modules/domain/ai-usage-events"
import { AgentWorkAccessService, boardOf, type AgentRunsBoard } from "@modules/domain/agent-work"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { AgentGraphsService } from "@modules/domain/agent-graphs"

/** The work items read to give each run its sentence: the ones the work log reads. */
const ITEMS_READ = 100

/** What the list of a workspace with no such agent says. */
const noRuns = (concurrencyLimit: number): AgentRunsBoard => ({
    runs: [],
    workflows: [],
    runningCount: 0,
    queuedCount: 0,
    concurrencyLimit,
    activeCount: 0,
})

@Injectable()
/** The runs of one agent to an owner or manager: the newest runs with their progress, the workflows they ran and what waits. */
export class AgentRunBoardService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly access: AgentWorkAccessService,
        private readonly runs: AgentRunsViewService,
        private readonly graphs: AgentGraphsService,
        private readonly items: WorkItemsViewsReadService,
        private readonly usage: AiUsageEventsService,
        private readonly limit: AgentRunsLimitService,
    ) {}

    /** The board of the agent instance; an instance that drives no agent has an empty one. */
    async board(userId: string, workspaceId: string, installationId: string): Promise<AgentRunsBoard> {
        const installation = await this.access.managedInstallation(userId, workspaceId, installationId)
        if (installation?.agentId == null) return noRuns(this.limit.concurrency)
        const { agentId } = installation
        const [entries, versions, items] = await Promise.all([
            this.runs.list(workspaceId, agentId),
            this.graphs.versionsOf(workspaceId, agentId),
            this.items.ofInstallation(workspaceId, installationId, ITEMS_READ),
        ])
        return boardOf(
            entries,
            new Map(versions.map((version) => [version.id, version.version])),
            new Map(items.map((item) => [item.id, item])),
            this.clock.now(),
            {
                credits: await this.usage.creditsByRun(
                    workspaceId,
                    entries.map((entry) => entry.run.id),
                ),
                concurrencyLimit: this.limit.concurrency,
            },
        )
    }
}
