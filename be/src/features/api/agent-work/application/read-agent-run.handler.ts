import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphDecisionsService, AgentGraphsService } from "@modules/domain/agent-graphs"
import { AgentRunsViewService } from "@modules/domain/agent-runs"
import { AiUsageEventsService } from "@modules/domain/ai-usage-events"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { decidingItemIdOf, decisionOf } from "./agent-run-decision.policy"
import { detailOf, itemOf } from "./agent-runs-view.policy"
import { ReadAgentRunQuery } from "./read-agent-run.query"
import type { AgentRunDecision, AgentRunDetail, AgentRunItem } from "./read-agent-runs.contracts"

@QueryHandler(ReadAgentRunQuery)
/** Answers one run of an agent to an owner or manager: its steps with their moments, tries and door calls, and the work item it is about. */
export class ReadAgentRunHandler extends ICQRSHandler<ReadAgentRunQuery, AgentRunDetail | null> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly access: AgentWorkAccessService,
        private readonly installations: InstallationRecordsService,
        private readonly runs: AgentRunsViewService,
        private readonly graphs: AgentGraphsService,
        private readonly items: WorkItemsViewsReadService,
        private readonly usage: AiUsageEventsService,
        private readonly decisions: AgentGraphDecisionsService,
    ) {
        super(logger)
    }

    protected override async process(query: ReadAgentRunQuery): Promise<AgentRunDetail | null> {
        const { workspaceId, installationId, runId } = query.params.request
        await this.access.manager(query.params.principal.id, workspaceId)
        const installation = await this.installations.find(workspaceId, installationId)
        if (installation?.agentId == null) return null
        const { agentId } = installation
        const detail = await this.runs.detail(workspaceId, agentId, runId)
        if (detail === null) return null
        const itemId = detail.steps.find((step) => step.waitItemId !== null || step.workItemId !== null)
        const found =
            itemId === undefined ? null : await this.items.find(workspaceId, itemId.waitItemId ?? itemId.workItemId ?? "")
        const versions = await this.graphs.versionsOf(workspaceId, agentId)
        const read = detailOf(
            detail,
            new Map(versions.map((version) => [version.id, version.version])),
            found?.item ?? null,
            this.clock.now(),
            await this.usage.creditsByRun(workspaceId, [runId]),
        )
        return {
            ...read,
            decision: await this.decisionFor(workspaceId, read),
            aiCalls: await this.usage.callKindsByRun(workspaceId, runId),
        }
    }

    /** The decision the run waits on, with the open request of the approval road when the graph asked a group; null when no item waits. */
    private async decisionFor(workspaceId: string, read: AgentRunDetail): Promise<AgentRunDecision | null> {
        const deciding = decidingItemIdOf(read.steps, read.item)
        if (deciding === null) return null
        const decidingItem = read.item?.id === deciding ? read.item : await this.itemOf(workspaceId, deciding)
        if (decidingItem === null) return null
        const asked = await this.decisions.byItem(workspaceId, deciding)
        return decisionOf(read.steps, decidingItem, asked === null || asked.closed ? null : asked.approvalRequestId)
    }

    private async itemOf(workspaceId: string, itemId: string): Promise<AgentRunItem | null> {
        const found = await this.items.find(workspaceId, itemId)
        return found === null ? null : itemOf(found.item)
    }
}
