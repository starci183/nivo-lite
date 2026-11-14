import { Injectable } from "@nestjs/common"
import { AgentRunsService, type RunView } from "@modules/domain/agent-runs"
import { tagPayloadOf, type AgentTurnView } from "@modules/domain/agent-work"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import type { FlowTriggerScope } from "./agent-graphs.contracts"
import type { WorkflowRoute } from "./agent-workflows.contracts"
import {
    CALL_DEPTH_MAX,
    STANDING_RUN,
    callContactOf,
    callOf,
    chainRefusalOf,
    duplicates,
    paramHashOf,
    type CallLink,
    type CallRefusal,
    type WorkflowCallFacts,
} from "./policies/workflow-call-guard.policy"

/** The most standing runs of the target one duplicate check reads. */
const STANDING_LOOKUP = 20

/** The flow a wake is about to start, as the guards read it: its graph and the workflow route it was pinned to, if any. */
export interface GuardedFlow {
    /** The graph. */
    readonly flow: GraphSpec
    /** The workflow route, or null for the agent's own graph. */
    readonly route: WorkflowRoute | null
}

/** Why a call was refused, or null when it may start. */
export type OptionalCallRefusal = CallRefusal | null

/** The name a run with no workflow pin is compared under: the agent's own graph. */
const OWN_GRAPH = "agent-graph"

/** The call that made a run, read back from the plain data of its wake (the run's context), or null for a run no call made. */
const callOfContext = (context: { readonly tagContext?: unknown }): WorkflowCallFacts | null => {
    const text = context.tagContext
    return typeof text === "string" ? callOf(tagPayloadOf({ tagContext: text })) : null
}

/** The call that made a run, or null for a run no call made. */
const callOfRun = (run: RunView): WorkflowCallFacts | null => callOfContext(run.context)

/** The run that called the run of this context (its parent), or null for a run no call made: the waits ask a child before its parent. */
export const callerRunIdOf = (context: { readonly tagContext?: unknown }): string | null => callOfContext(context)?.callerRunId ?? null

@Injectable()
/**
 * The engine's guards on a workflow another workflow calls (an end hand-off of `core.call-workflow`), asked at the start of the run before
 * any step is written. A call never crosses workspaces (its calling run must be a run of the same workspace); a target open only to its
 * own agent takes no call of another agent; a chain of calls is at most `CALL_DEPTH_MAX` workflows deep and never runs the same
 * workflow twice for the same lead with the same params; and a target that still has a standing run (running, waiting or parked) for
 * the same lead with the same params is not started again. A wake no call made passes untouched: a customer's line, a timer, a feed.
 */
export class AgentGraphCallGuardService {
    constructor(
        private readonly runs: AgentRunsService,
        private readonly engine: EntityEngineService,
        private readonly records: AgentWorkflowRecordsService,
        private readonly workflows: AgentWorkflowRunsService,
    ) {}

    /** Why the call that woke `turn` may not start `active`, or null when it may (and for a wake no call made). */
    async refusalOf(turn: AgentTurnView, trigger: FlowTriggerScope, active: GuardedFlow): Promise<OptionalCallRefusal> {
        // A call of the one pipeline carries the call on its wake (`tagContext`, written by `deliver`), never in the trigger scope.
        const call = callOfContext(turn.context)
        if (call === null) return null
        const caller = await this.runs.runOf(turn.workspaceId, call.callerRunId)
        if (caller?.workspaceId !== turn.workspaceId) return "call_caller_unknown"
        if (active.flow.entry?.openTo === "agent" && caller.agentId !== turn.agentId) return "call_not_open"
        const target: CallLink = {
            agentId: turn.agentId,
            workflow: active.route?.workflowId ?? OWN_GRAPH,
            contactId: callContactOf(trigger, call),
            paramHash: paramHashOf(call.params),
        }
        const chained = chainRefusalOf(target, await this.chainOf(turn.workspaceId, caller))
        if (chained !== null) return chained
        return (await this.standing(turn, target)) ? "call_duplicate" : null
    }

    /** The workflows that led to the call, nearest first: the caller, then whoever called it, up to one past the depth limit. */
    private async chainOf(
        workspaceId: string,
        run: RunView,
        links: ReadonlyArray<CallLink> = [],
    ): Promise<ReadonlyArray<CallLink>> {
        const chain = [...links, await this.linkOf(workspaceId, run)]
        const call = callOfRun(run)
        if (call === null || chain.length > CALL_DEPTH_MAX) return chain
        const caller = await this.runs.runOf(workspaceId, call.callerRunId)
        return caller === null ? chain : this.chainOf(workspaceId, caller, chain)
    }

    /** One run as a link of a chain: its agent, its workflow pin, its contact and the params it was called with. */
    private async linkOf(workspaceId: string, run: RunView): Promise<CallLink> {
        const [pin] = await this.workflows.pinsOf(workspaceId, [run.id])
        const call = callOfRun(run)
        return {
            agentId: run.agentId,
            workflow: pin?.workflowId ?? OWN_GRAPH,
            contactId: call === null ? textOf(run.context.contactId) : callContactOf(run.context, call),
            paramHash: paramHashOf(call?.params ?? {}),
        }
    }

    /** Whether a run of the target still stands for the same contact with the same params; a replay of this very wake is not one. */
    private async standing(turn: AgentTurnView, target: CallLink): Promise<boolean> {
        if (target.workflow === OWN_GRAPH) return false
        const pins = await this.engine.scoped(turn.workspaceId, (tx) =>
            this.records.runsOfWorkflow(tx, turn.agentId, target.workflow, STANDING_LOOKUP),
        )
        const runs = await Promise.all(pins.map((pin) => this.runs.runOf(turn.workspaceId, pin.runId)))
        return runs.some((run) => {
            if (run === null || run.wakeId === turn.wakeId || !STANDING_RUN.has(run.status)) return false
            const call = callOfRun(run)
            if (call === null) return false
            const link = {
                agentId: run.agentId,
                workflow: target.workflow,
                contactId: callContactOf(run.context, call),
                paramHash: paramHashOf(call.params),
            }
            return duplicates(target, link)
        })
    }
}

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)
