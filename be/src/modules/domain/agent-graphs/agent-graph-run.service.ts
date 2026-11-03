import { Injectable } from "@nestjs/common"
import { AgentWorkReadService } from "@modules/domain/agent-work"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import { runTraceOf, triggerStepOf } from "./policies/run-trace.policy"
import { runEntryWireOf } from "./policies/graph-wire.policy"
import type { AgentGraphRunEntryWire, AgentGraphRunWire } from "./policies/graph-wire.policy"

@Injectable()
/**
 * The trace of one run: which trigger woke the agent, which branch the condition took, the nodes the work went through and the version
 * of the graph that decided, as that version drew them. A decision keeps its version through a later publish, so the trace always reads
 * the graph that really decided.
 */
export class AgentGraphRunService {
    constructor(
        private readonly decisions: AgentGraphDecisionsService,
        private readonly graphs: AgentGraphsService,
        private readonly work: AgentWorkReadService,
    ) {}

    /** The latest runs of the agent, newest first, each with the number of the version it ran on. */
    async runsOf(workspaceId: string, agentId: string, limit: number): Promise<ReadonlyArray<AgentGraphRunEntryWire>> {
        const runs = await this.decisions.runsOf(workspaceId, agentId, limit)
        const versions = await this.graphs.versionsOf(workspaceId, agentId)
        return runs.map((run) =>
            runEntryWireOf(run, versions.find((entry) => entry.id === run.versionId)?.version ?? null),
        )
    }

    /** The run of a work item; refused when the graph never decided it. */
    async runOf(workspaceId: string, workItemId: string): Promise<AgentGraphRunWire> {
        const run = await this.decisions.runOf(workspaceId, workItemId)
        if (run === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.RunNotFound })
        const [drawn, source, origin] = await Promise.all([
            this.graphs.versionAt(workspaceId, run.agentId, run.versionId),
            run.wakeId === null ? Promise.resolve(null) : this.work.wakeSourceOf(workspaceId, run.wakeId),
            run.wakeId === null ? Promise.resolve(null) : this.work.wakeOriginOf(workspaceId, run.wakeId),
        ])
        const trigger = triggerStepOf(source)
        return {
            decisionId: run.id,
            agentId: run.agentId,
            versionId: run.versionId,
            version: drawn.version,
            trigger,
            origin,
            branchKey: run.branchKey,
            outcome: run.outcome,
            closedAs: run.closedAs,
            shadowDiff: run.shadowDiff,
            approvalRequestId: run.approvalRequestId,
            factsJson: JSON.stringify(run.facts),
            traceJson: JSON.stringify(
                runTraceOf(drawn.document, { action: run.action, branchKey: run.branchKey, trigger, path: run.path }),
            ),
        }
    }
}
