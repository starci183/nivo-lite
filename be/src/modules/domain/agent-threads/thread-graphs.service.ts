import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { InjectGraphThreads } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadGraph, ThreadNodeScope, ThreadRef, ThreadState } from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectAgentThreadsOptions } from "./agent-threads.decorators"
import { RunStopsService } from "./stops/run-stops.service"
import { AgentThreadsLogEvent } from "./agent-threads.log-events"
import type { AgentThreadsOptions } from "./agent-threads.options"
import { AgentThreadsError, AgentThreadsErrorCode } from "./errors/agent-threads.error"
import { compileTemplate } from "./template-compiler.policy"
import type { CompiledTemplate } from "./template-compiler.policy"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadStepService } from "./thread-step.service"

/** How many built graphs are kept unless the app says otherwise: one per workflow version, five or six nodes each. */
const DEFAULT_GRAPHS_MAX = 200

/** The problem named when a pinned version holds no node graph at all. */
const NO_FLOW = "TEMPLATE_EMPTY"

/** What of a run its nodes need while it is driven: it belongs to the run, not to the version, so it is never built into a graph. */
export interface DrivenRun {
    /** The agent of the run. */
    readonly agentId: string
    /** `<moduleKey>.<workflowKey>`. */
    readonly namespace: string
    /** The workflow the run is pinned to, or null. */
    readonly workflowId: string | null
}

/** A version to build a graph from when the caller already holds its spec (the wake's route). */
export interface RoutedVersion {
    /** The version id: the pin of the thread and the key the built graph is kept under. */
    readonly versionId: string
    /** The graph of that version. */
    readonly flow: GraphSpec
    /** The workflow version number, or null for the agent's own graph. */
    readonly number: number | null
}

/** One built graph: the port's graph of a version and the spec it was built from. */
interface Built {
    readonly graph: ThreadGraph
    readonly flow: GraphSpec
}

@Injectable()
/**
 * The thread graphs of the engine: one per workflow VERSION, built once per process from the template compiler's description and
 * kept by version id (the oldest leaves first). A thread is always handed the graph of the version it is pinned to, read by that id,
 * never the version that is active now: a resume on a changed graph would do nothing and say nothing.
 *
 * A graph is a function of its version alone. What belongs to one run (its agent, workflow and namespace) is registered for the time
 * of a drive (`driving`) and read when a node runs, so two runs of one version never see each other's facts. The same registry is the
 * process's own guard: a run that is being driven is not driven a second time.
 */
export class ThreadGraphsService {
    /** The built graphs by version id, oldest first. */
    private readonly built = new Map<string, Built>()

    /** The runs this process is driving now, with what their nodes read of them. */
    private readonly runs = new Map<string, DrivenRun>()

    constructor(
        @InjectAgentThreadsOptions() private readonly options: AgentThreadsOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly graphs: AgentGraphsService,
        private readonly nodes: GraphNodeRegistryService,
        private readonly steps: ThreadStepService,
        private readonly projection: ThreadProjectionService,
        @Optional() @InjectGraphThreads() private readonly port?: GraphThreads,
        @Optional() private readonly stops?: RunStopsService,
    ) {}

    /** Marks a step whose visit the checkpoint refused as too large: its next visit stops for the founder (see `ThreadStepService`). */
    oversize(runId: string, stepKey: string, bytes: number, limit: number): void {
        this.steps.oversize(runId, stepKey, bytes, limit)
    }

    /** True while this process drives the run. */
    isDriving(runId: string): boolean {
        return this.runs.has(runId)
    }

    /** Runs `drive` with the run registered as driven, so its nodes read its facts; the run is released however the drive ends. */
    async driving<Result>(runId: string, run: DrivenRun, drive: () => Promise<Result>): Promise<Result> {
        this.runs.set(runId, run)
        try {
            return await drive()
        } finally {
            this.runs.delete(runId)
        }
    }

    /** The module of a built version, or null when this process has not built it. */
    moduleKeyOf(versionId: string): string | null {
        return this.built.get(versionId)?.flow.moduleKey ?? null
    }

    /** The graph of the version a thread is pinned to, read by its id: never the version that is active now. */
    async pinned(ref: ThreadRef, agentId: string, versionId: string): Promise<ThreadGraph> {
        const kept = this.built.get(versionId)
        if (kept !== undefined) return kept.graph
        const at = await this.graphs.versionAt(ref.workspaceId, agentId, versionId)
        const flow = at.document.flow
        if (flow === undefined) throw await this.refused(ref, versionId, NO_FLOW, versionId)
        return this.routed(ref, { versionId, flow, number: at.version })
    }

    /** The built graph of a version whose spec the caller holds, kept by version id: compiled and built once per process. */
    async routed(ref: ThreadRef, version: RoutedVersion): Promise<ThreadGraph> {
        const { versionId, flow } = version
        const kept = this.built.get(versionId)
        if (kept !== undefined) return kept.graph
        const compiled = compileTemplate(
            {
                pin: {
                    versionId,
                    workflowId: null,
                    number: version.number ?? 0,
                    documentHash: null,
                    templateId: null,
                    templateVersion: null,
                },
                spec: flow,
            },
            new Set(this.nodes.installed().nodes.keys()),
        )
        if (compiled.kind === "refused") {
            const [problem] = compiled.problems
            throw await this.refused(ref, versionId, problem?.code ?? NO_FLOW, problem?.at ?? versionId)
        }
        const graph = this.graphFrom(compiled.graph, flow)
        this.built.set(versionId, { graph, flow })
        const oldest = this.built.keys().next()
        if (this.built.size > (this.options.graphsMax ?? DEFAULT_GRAPHS_MAX) && oldest.done !== true)
            this.built.delete(oldest.value)
        return graph
    }

    /**
     * A pinned version that cannot run: no step can stop for it, so the run is closed as failed, every stop of it that still waits
     * closes with it (its card rewritten as resolved, no live button) and the drive is refused by name (never a silent end). The wake fails with it, and the flow tells the founder when its tries are spent.
     */
    private async refused(ref: ThreadRef, versionId: string, problem: string, at: string): Promise<AgentThreadsError> {
        await this.projection.runEnded(ref, { outcome: "failed", code: problem, by: null, at: this.clock.now() })
        // A stop of the run that still waits would offer live buttons on a run that reads failed: it closes with the run.
        const seen = await this.port?.stateOf(ref)
        const trigger: unknown = seen?.state.trigger
        const locale = typeof trigger === "object" && trigger !== null && "locale" in trigger && trigger.locale === "en" ? "en" : "vi"
        await this.stops?.runClosed(ref, { locale })
        this.logger.warn(AgentThreadsLogEvent.TemplateRefused, { runId: ref.runId, versionId, code: problem })
        return new AgentThreadsError({
            code: AgentThreadsErrorCode.TemplateRefused,
            params: { version: versionId, problem, at },
        })
    }

    /**
     * The port's graph of a compiled version: each step runs the node function, the gate runs the stop. No node has a `next`: the
     * node function always names where the thread goes (the step's exit, or the gate when it cannot complete).
     */
    private graphFrom(compiled: CompiledTemplate, flow: GraphSpec): ThreadGraph {
        if (this.port === undefined) throw new AgentThreadsError({ code: AgentThreadsErrorCode.PortMissing })
        const versionId = compiled.pin.versionId
        const replay = this.port.replayPortsOf
        return {
            version: versionId,
            entry: compiled.entry,
            nodes: [
                ...compiled.nodes.map((step) => ({
                    key: step.key,
                    ends: step.ends,
                    run: (state: ThreadState, scope: ThreadNodeScope) =>
                        this.steps.run({ ...this.runOf(scope), versionId, flow, step, replay }, state, scope),
                })),
                {
                    key: compiled.freeze.key,
                    ends: compiled.freeze.ends,
                    run: (state: ThreadState, scope: ThreadNodeScope) =>
                        this.steps.gate({ agentId: this.runOf(scope).agentId }, state, scope),
                },
            ],
        }
    }

    private runOf(scope: ThreadNodeScope): DrivenRun {
        const run = this.runs.get(scope.thread.runId)
        if (run === undefined)
            throw new AgentThreadsError({ code: AgentThreadsErrorCode.NotDriving, params: { runId: scope.thread.runId } })
        return run
    }
}
