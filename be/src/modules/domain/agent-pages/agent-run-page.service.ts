import { Injectable } from "@nestjs/common"
import { AgentRunsViewService } from "@modules/domain/agent-runs"
import { AiUsageEventsService, runTotalsOf } from "@modules/domain/ai-usage-events"
import {
    AgentWorkAccessService,
    decidingItemIdOf,
    decisionOf,
    detailOf,
    itemOf,
    type AgentRunDecision,
    type AgentRunDetail,
    type AgentRunItem,
} from "@modules/domain/agent-work"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { WorkItemsViewsReadService } from "@modules/domain/work-items"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import type { OptionalAgentRunDetail, OptionalLocale } from "./agent-pages.contracts"
import { aiCallLabelOf } from "./ai-call-label.policy"

/** The language of a run page that names none. */
const DEFAULT_LOCALE = "vi"

/** The most truth-graph reads one run page lists. */
const TRUTH_READS_MAX = 100

@Injectable()
/** One run of an agent to an owner or manager: its steps with their moments, tries and door calls, and the work item it is about. */
export class AgentRunPageService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly access: AgentWorkAccessService,
        private readonly runs: AgentRunsViewService,
        private readonly graphs: AgentGraphsService,
        private readonly items: WorkItemsViewsReadService,
        private readonly usage: AiUsageEventsService,
        private readonly callLog: ToolCallLogService,
    ) {}

    /** The page of the run, in the language named (Vietnamese when absent); null when the instance or the run is not there. */
    async page(
        userId: string,
        workspaceId: string,
        installationId: string,
        runId: string,
        locale: OptionalLocale,
    ): Promise<OptionalAgentRunDetail> {
        const installation = await this.access.managedInstallation(userId, workspaceId, installationId)
        if (installation?.agentId == null) return null
        const { agentId } = installation
        const detail = await this.runs.detail(workspaceId, agentId, runId)
        if (detail === null) return null
        const itemId = detail.steps.find((step) => step.waitItemId !== null || step.workItemId !== null)
        const found =
            itemId === undefined
                ? null
                : await this.items.find(workspaceId, itemId.waitItemId ?? itemId.workItemId ?? "")
        const versions = await this.graphs.versionsOf(workspaceId, agentId)
        const read = detailOf(
            detail,
            new Map(versions.map((version) => [version.id, version.version])),
            found?.item ?? null,
            this.clock.now(),
            await this.usage.creditsByRun(workspaceId, [runId]),
        )
        const language = locale ?? DEFAULT_LOCALE
        const aiCalls = (await this.usage.callKindsByRun(workspaceId, runId)).map((call) => ({
            ...call,
            label: aiCallLabelOf(call.purpose, language),
        }))
        const truthReads = (await this.callLog.truthReadsOfRun(workspaceId, runId, TRUTH_READS_MAX)).map((line) => ({
            tool: line.tool,
            at: line.at.toISOString(),
            facts: line.facts.map((fact) => ({ factId: fact.factId, version: fact.version })),
        }))
        return {
            ...read,
            decision: await this.decisionFor(workspaceId, read),
            aiCalls,
            aiTotals: runTotalsOf(aiCalls),
            truthReads,
        }
    }

    /** The decision the run waits on (its work item); null when no item waits. */
    private async decisionFor(workspaceId: string, read: AgentRunDetail): Promise<AgentRunDecision | null> {
        const deciding = decidingItemIdOf(read.steps, read.item)
        if (deciding === null) return null
        const decidingItem = read.item?.id === deciding ? read.item : await this.itemOf(workspaceId, deciding)
        if (decidingItem === null) return null
        return decisionOf(read.steps, decidingItem)
    }

    private async itemOf(workspaceId: string, itemId: string): Promise<AgentRunItem | null> {
        const found = await this.items.find(workspaceId, itemId)
        return found === null ? null : itemOf(found.item)
    }
}
