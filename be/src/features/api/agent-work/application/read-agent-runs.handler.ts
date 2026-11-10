import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { AgentRunsLimitService, AgentRunsViewService } from "@modules/domain/agent-runs"
import { AiUsageEventsService } from "@modules/domain/ai-usage-events"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { boardOf } from "./agent-runs-view.policy"
import { ReadAgentRunsQuery } from "./read-agent-runs.query"
import type { AgentRunsBoard } from "./read-agent-runs.contracts"

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

@QueryHandler(ReadAgentRunsQuery)
/** Answers the runs of one agent to an owner or manager: the newest runs with their progress, the workflows they ran and what waits. */
export class ReadAgentRunsHandler extends ICQRSHandler<ReadAgentRunsQuery, AgentRunsBoard> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly access: AgentWorkAccessService,
        private readonly installations: InstallationRecordsService,
        private readonly runs: AgentRunsViewService,
        private readonly graphs: AgentGraphsService,
        private readonly items: WorkItemsViewsReadService,
        private readonly usage: AiUsageEventsService,
        private readonly limit: AgentRunsLimitService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadAgentRunsQuery): Promise<AgentRunsBoard> {
        const { workspaceId, installationId } = query.params.request
        await this.access.manager(query.params.principal.id, workspaceId)
        const installation = await this.installations.find(workspaceId, installationId)
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
