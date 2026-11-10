import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import { nodeSagaOf } from "@nivo-lite/agent-sdk/node"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { StepSpec } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import type { AgentHandlerEnding, AgentTurnView, AgentWorkFlow } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { FlowTriggerScope } from "./agent-graphs.contracts"
import { InjectFlowTriggerMessages } from "./agent-graphs.decorators"
import type { FlowTriggerMessages } from "./agent-graphs.port"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentGraphFreezeGateService } from "./agent-graph-freeze-gate.service"
import { AgentGraphCallGuardService } from "./agent-graph-call-guard.service"
import { AgentGraphHoursGateService } from "./agent-graph-hours-gate.service"
import { AgentGraphConversationHoldsService } from "./agent-graph-conversation-holds.service"
import type { WorkflowRoute } from "./agent-workflows.contracts"
import { AgentGraphWakeNoticesService } from "./agent-graph-wake-notices.service"
import type { UntakenReason } from "./agent-graph-wake-notices.service"
import {
    GRAPH_FLOW_TRIGGER,
    graphNodeStepOf,
    namespaceOf,
    tagSourceOf,
    triggerScopeOf,
} from "./policies/graph-flow.policy"
import { CALLER_MEMBER, WAITING_MEMBER, takingTriggerOf, workflowCallOf } from "./policies/workflow-trigger.policy"
import { tagPayloadOf } from "@modules/domain/agent-work"
import type { GraphNodeStepInput } from "./policies/graph-flow.policy"

/** The source of a wake a customer's line makes. */
const CUSTOMER_SOURCE = "customer"

/** Why a customer wake started no run: no workflow of the agent took it. */
const NO_WORKFLOW = "no_workflow"

/** True when the flow found for a wake takes it: a workflow routed it, or the agent's own graph is triggered by its source. */
const takenBy = (active: ActiveFlow | null, turn: AgentTurnView): active is ActiveFlow =>
    active !== null && (active.route !== null || active.flow.trigger.sources.includes(tagSourceOf(turn)))

/** Why a wake started no run: its customer is frozen until the owner deals with a run that failed; the wake waits as a pending event. */
const LEAD_FROZEN = "lead_frozen"

/** Why a customer's wake started no run: the agent is off duty and does not answer after hours; it waits for the next working hour. */
const OUTSIDE_HOURS = "outside_hours"

/** Why a customer's wake started no run here: another agent keeps the conversation (an open consult), so it went on to that agent. */
const CONVERSATION_HELD = "conversation_held"

/** The engine a run is on: the old step engine, or a LangGraph thread. */
export type FlowRunEngine = "legacy" | "langgraph"

/** The engine a wake's run already started on, or null when the wake has no run yet. */
export type OptionalFlowRunEngine = FlowRunEngine | null

/** A run the flow opened for a thread: everything the thread needs to start, or to go on when the wake is tried again. */
export interface FlowThreadRun {
    /** The wake's turn: its fence and scope are the lease the thread is driven under. */
    readonly turn: AgentTurnView
    /** The run, which is the thread. */
    readonly runId: string
    /** The version the wake was routed to; a run tried again stays on the version it started on. */
    readonly versionId: string
    /** The graph of that version. */
    readonly flow: GraphSpec
    /** `<moduleKey>.<workflowKey>` of the workflow. */
    readonly namespace: string
    /** The workflow the run is pinned to, or null for the agent's own graph. */
    readonly workflowId: string | null
    /** The workflow version number, or null for the agent's own graph. */
    readonly workflowVersion: number | null
    /** The trigger scope the nodes read as `trigger.*`. */
    readonly trigger: FlowTriggerScope
}

/**
 * The thread runs as the flow sees them: the capability that runs a workflow on a LangGraph thread registers itself here when the app
 * starts (`setThreads`). With none registered every run is the old engine's, exactly as before.
 */
export interface FlowThreads {
    /** True when a NEW run of this workflow (`<moduleKey>.<workflowKey>`) starts on a thread. */
    engages(namespace: string): boolean
    /** True when the wake is a thread's own (a founder's decision or a re-drive of a run): the flow hands it over and does nothing else. */
    owns(turn: AgentTurnView): boolean
    /** The engine the run of this wake started on, or null when the wake has no run yet. */
    engineOfWake(turn: AgentTurnView): Promise<OptionalFlowRunEngine>
    /** Marks the run just opened as a thread's, in the transaction that opened it. */
    opened(tx: EntityManager, workspaceId: string, runId: string): Promise<void>
    /** Starts the thread of the run under the wake's lease (or goes on with it when the wake is tried again) and answers how the wake ends. */
    started(run: FlowThreadRun, signal: AbortSignal): Promise<AgentHandlerEnding>
    /** Runs a wake the threads own, under its lease. */
    woken(turn: AgentTurnView, signal: AbortSignal): Promise<AgentHandlerEnding>
}

/** The member of a thread run's context that keeps the lock scope its wake ran under: every later drive of the thread takes that scope. */
export const THREAD_SCOPE_MEMBER = "threadScope"

/** What joins the customer messages of a burst into one text. */
const LINE = "\n"

/** The active node graph of an agent and the version it is frozen in, or null when the agent runs no node graph. */
interface ActiveFlow {
    readonly flow: GraphSpec
    readonly versionId: string
    /** The workflow version the run is pinned to, or null when the agent's own graph answers unpinned. */
    readonly route: WorkflowRoute | null
}

/**
 * Why no workflow took a customer wake: the agent has no workflow at all yet, none of its workflows is switched on, or none of the
 * running ones has a trigger for the wake.
 */
const untakenReasonOf = (standing: { readonly total: number; readonly running: ReadonlyArray<string> }): UntakenReason => {
    if (standing.total === 0) return "no_workflow"
    return standing.running.length === 0 ? "no_workflow_running" : "no_trigger_takes_wake"
}

@Injectable()
/**
 * Runs the wakes of an agent whose published graph is a node graph, with no model turn. It takes a wake when the active version holds a
 * flow whose tag trigger names where the wake came from, opens the wake's run and writes the step of the first node; the run engine
 * drives the rest, one durable step per node. The steps that follow are the step handler's to write.
 */
export class AgentGraphFlowRunsService implements AgentWorkFlow, OnModuleInit {
    /** The thread runs, once their capability registered; undefined runs everything on the old engine. */
    private threads: FlowThreads | undefined

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly graphs: AgentGraphsService,
        private readonly runs: AgentRunsService,
        private readonly handlers: AgentWorkHandlersService,
        private readonly nodes: GraphNodeRegistryService,
        @Optional() @InjectFlowTriggerMessages() private readonly messages: FlowTriggerMessages | null = null,
        @Optional() private readonly workflows?: AgentWorkflowRunsService,
        @Optional() @InjectLogger() private readonly logger: Logger | null = null,
        @Optional() private readonly freezes?: AgentGraphFreezeGateService,
        @Optional() private readonly calls?: AgentGraphCallGuardService,
        @Optional() private readonly hours?: AgentGraphHoursGateService,
        @Optional() private readonly holds?: AgentGraphConversationHoldsService,
        @Optional() private readonly wakeNotices?: AgentGraphWakeNoticesService,
    ) {}

    /** Sets itself as the flow the drain asks before any handler, once the app has started. */
    onModuleInit(): void {
        this.handlers.setFlow(this)
    }

    /** Registers the thread runs: the workflows they engage start on a thread, and their own wakes are handed to them. */
    setThreads(threads: FlowThreads): void {
        this.threads = threads
    }

    /**
     * True when a workflow of the agent takes the wake (a trigger of it, or the pin of a hand-off), or its own graph is woken from
     * there. EVERY customer wake is this flow's, whatever the agent: workflows are the only thing that answers a customer, so an
     * agent with no workflow at all, one whose workflows take no such wake, and a routing that fails all end in `run` (which tells
     * the founder, or fails the wake). No turn outside a workflow exists to hand a customer to.
     */
    async takes(turn: AgentTurnView): Promise<boolean> {
        if (this.threads?.owns(turn) === true) return true
        if (turn.source === CUSTOMER_SOURCE) return true
        try {
            return takenBy(await this.flowOf(turn), turn)
        } catch (cause) {
            this.logger?.error(AgentGraphsLogEvent.WorkflowRouteFailed, cause, { agentId: turn.agentId })
            return true
        }
    }

    /**
     * A wake of this flow that failed for good (its tries are spent, or it could never run): the founder is told with the facts, in
     * place of any handler's own words. No workflow step exists to hand to the AI core or to freeze on.
     */
    async stuck(turn: AgentTurnView, code: string): Promise<void> {
        await this.wakeNotices?.failed(turn, code)
    }

    /** Ends a customer wake no workflow took: the founder is told why with the facts, the customer is told nothing, nothing runs. */
    private async untaken(turn: AgentTurnView): Promise<AgentHandlerEnding> {
        const standing = (await this.workflows?.standingOf(turn.workspaceId, turn.agentId)) ?? {
            total: 0,
            running: [],
            sources: [],
        }
        // An agent that runs a graph of its own has a workflow, whatever the workflow records count.
        const ownGraph = standing.total === 0 && (await this.activeOf(turn.workspaceId, turn.agentId)) !== null
        const reason = ownGraph ? "no_trigger_takes_wake" : untakenReasonOf(standing)
        this.logger?.warn(AgentGraphsLogEvent.WakeUntaken, { agentId: turn.agentId, wakeId: turn.wakeId, code: reason })
        await this.wakeNotices?.untaken(turn, { reason, running: standing.running, sources: standing.sources })
        return { status: "skipped", reason: NO_WORKFLOW, outcome: null }
    }

    /**
     * Opens the wake's run and writes the step of the first node; a replay of the wake finds the run and the step already there. A
     * workflow the thread runs engage opens its run as a thread's instead and is driven there under the wake's lease (`signal` aborts
     * when the lease is lost); a wake the threads own goes straight to them.
     */
    async run(turn: AgentTurnView, signal: AbortSignal = new AbortController().signal): Promise<AgentHandlerEnding> {
        if (this.threads?.owns(turn) === true) return this.threads.woken(turn, signal)
        const active = await this.flowOf(turn)
        if (!takenBy(active, turn) && turn.source === CUSTOMER_SOURCE) return this.untaken(turn)
        const first = active?.flow.nodes[0]
        if (active === null || first === undefined) return { status: "skipped", reason: "no_flow", outcome: null }
        const trigger = await this.withCaller(turn, {
            ...(await this.triggerOf(turn)),
            ...this.triggerKeyOf(active, turn),
        })
        if (await this.hours?.deferred(turn)) return { status: "held", reason: OUTSIDE_HOURS, outcome: null }
        if (await this.holds?.redirected(turn)) return { status: "skipped", reason: CONVERSATION_HELD, outcome: null }
        // A freeze holds one workflow of the customer: only a wake of that workflow waits, every other one runs.
        const pinned = { ...trigger, workflowId: active.route?.workflowId ?? null }
        if (await this.freezes?.hold(turn, pinned)) return { status: "held", reason: LEAD_FROZEN, outcome: null }
        const waiting = (await this.freezes?.waitingOf(turn.workspaceId, trigger)) ?? []
        const told: FlowTriggerScope = waiting.length === 0 ? trigger : { ...trigger, [WAITING_MEMBER]: waiting }
        const refused = (await this.calls?.refusalOf(turn, trigger, active)) ?? null
        if (refused !== null) {
            this.logger?.warn(AgentGraphsLogEvent.CallRefused, {
                agentId: turn.agentId,
                wakeId: turn.wakeId,
                code: refused,
            })
            return { status: "skipped", reason: refused, outcome: null }
        }
        const namespace = namespaceOf(active.flow.moduleKey, active.route?.workflowKey)
        if (this.threads !== undefined && (await this.onThread(this.threads, turn, namespace)))
            return this.threadRun(this.threads, turn, active, namespace, told, signal)
        const runId = await this.entityManager.transaction(async (tx) => {
            const opened = await this.runs.open(tx, {
                workspaceId: turn.workspaceId,
                agentId: turn.agentId,
                wakeId: turn.wakeId,
                trigger: GRAPH_FLOW_TRIGGER,
                versionId: active.versionId,
                context: { ...turn.context },
            })
            if (active.route !== null && this.workflows !== undefined) {
                await this.workflows.pinRun(tx, turn.workspaceId, opened.id, active.route)
            }
            await this.runs.append(turn.workspaceId, tx, opened.id, [
                this.stepOf(first, {
                    versionId: active.versionId,
                    nodeKey: first.key,
                    trigger: told,
                    namespace,
                    workflowId: active.route?.workflowId ?? null,
                }),
            ])
            return opened.id
        })
        return { status: "done", reason: null, outcome: { runId } }
    }

    /**
     * Whether the wake's run is a thread's. A run stays on the engine it started on: a wake tried again reads the engine of the run
     * it already opened, whatever the flag says now; only a wake with no run yet asks the flag.
     */
    private async onThread(threads: FlowThreads, turn: AgentTurnView, namespace: string): Promise<boolean> {
        const started = turn.attempts > 1 ? await threads.engineOfWake(turn) : null
        return started === null ? threads.engages(namespace) : started === "langgraph"
    }

    /**
     * Opens the wake's run as a thread's (no step is written: the old engine has nothing to drive) and hands it to the thread runs,
     * which drive it under the wake's lease. The run keeps the lock scope of its wake, so every later drive takes the same lease.
     */
    private async threadRun(
        threads: FlowThreads,
        turn: AgentTurnView,
        active: ActiveFlow,
        namespace: string,
        trigger: FlowTriggerScope,
        signal: AbortSignal,
    ): Promise<AgentHandlerEnding> {
        const runId = await this.entityManager.transaction(async (tx) => {
            const opened = await this.runs.open(tx, {
                workspaceId: turn.workspaceId,
                agentId: turn.agentId,
                wakeId: turn.wakeId,
                trigger: GRAPH_FLOW_TRIGGER,
                versionId: active.versionId,
                context: { ...turn.context, [THREAD_SCOPE_MEMBER]: turn.scopeKey },
            })
            if (active.route !== null && this.workflows !== undefined) {
                await this.workflows.pinRun(tx, turn.workspaceId, opened.id, active.route)
            }
            await threads.opened(tx, turn.workspaceId, opened.id)
            return opened.id
        })
        return threads.started(
            {
                turn,
                runId,
                versionId: active.versionId,
                flow: active.flow,
                namespace,
                workflowId: active.route?.workflowId ?? null,
                workflowVersion: active.route?.workflowVersion ?? null,
                trigger,
            },
            signal,
        )
    }

    /**
     * The trigger scope of a wake. A channel wake carries the ids of the customer messages it answers (the message and the burst merged
     * into it), never the words, so they are read from the store: `text` joins them in the order they were said, `messages` keeps each
     * with its time and files, `messageIds` their ids, and `leadId` and `channel` come from the conversation. A tag keeps the words its
     * tagger gave.
     */
    async triggerOf(turn: AgentTurnView): Promise<FlowTriggerScope> {
        const scope = triggerScopeOf(turn)
        const { conversationId, messageId, mergedMessageIds } = turn.context
        if (
            scope.text !== undefined ||
            conversationId === undefined ||
            messageId === undefined ||
            this.messages === null
        ) {
            return scope
        }
        const ids = [messageId, ...(mergedMessageIds === undefined ? [] : mergedMessageIds.split(","))]
        const [said, conversation] = await Promise.all([
            this.messages.messagesOf(turn.workspaceId, conversationId, ids),
            this.messages.conversationOf(turn.workspaceId, conversationId),
        ])
        return {
            ...scope,
            leadId: scope.leadId ?? conversation?.leadId ?? null,
            channel: scope.channel ?? conversation?.channel ?? null,
            text: said.map((message) => message.text).join(LINE),
            messages: said.map((message) => ({ ...message, attachments: [...message.attachments] })),
            messageIds: said.map((message) => message.id),
        }
    }

    /** The key of the trigger of the workflow that took the wake, as `trigger.triggerKey`; nothing for a graph without typed triggers. */
    private triggerKeyOf(active: ActiveFlow, turn: AgentTurnView): Readonly<Record<string, string>> {
        const key = takingTriggerOf(active.flow, tagSourceOf(turn), triggerScopeOf(turn))
        return key === null || key === "" ? {} : { triggerKey: key }
    }

    /** The trigger scope with the caller's workflow filled in, for a hand-off whose calling run is pinned to one. */
    private async withCaller(turn: AgentTurnView, trigger: FlowTriggerScope): Promise<FlowTriggerScope> {
        const caller: unknown = Reflect.get(trigger, CALLER_MEMBER)
        if (typeof caller !== "object" || caller === null || this.workflows === undefined) return trigger
        const runId: unknown = Reflect.get(caller, "runId")
        if (typeof runId !== "string") return trigger
        const workflow = await this.workflows.workflowKeyOfRun(turn.workspaceId, runId).catch(() => null)
        return { ...trigger, [CALLER_MEMBER]: { ...caller, workflow } }
    }

    /** The step of a node, with its saga kind: a read, compensable when every effect it runs can be undone, else a pivot. */
    stepOf(node: GraphSpecNode, input: GraphNodeStepInput): StepSpec {
        const installed = this.nodes.installed()
        const definition = installed.nodes.get(node.step)
        return graphNodeStepOf(node, input, definition === undefined ? "read" : nodeSagaOf(definition, installed))
    }

    /**
     * The flow a wake runs: the workflow `AgentWorkflowsService.route` sends it to, pinned to that workflow's version; else the agent's
     * own active node graph, unpinned. Workflows that cannot be read never stop a wake: the agent's own graph answers it.
     */
    private async flowOf(turn: AgentTurnView): Promise<ActiveFlow | null> {
        const route = await this.routeOf(turn)
        if (route !== null) return { flow: route.flow, versionId: route.versionId, route }
        return this.activeOf(turn.workspaceId, turn.agentId)
    }

    private async routeOf(turn: AgentTurnView): Promise<WorkflowRoute | null> {
        if (this.workflows === undefined) return null
        const scope = triggerScopeOf(turn)
        const wake = { source: tagSourceOf(turn), scope, pin: workflowCallOf(tagPayloadOf(turn.context)) }
        // A routing that fails is a failure of the wake, never "no workflow": it throws, the wake is tried again, and when its tries
        // are spent the founder is told (`stuck`).
        return this.workflows.route(turn.workspaceId, turn.agentId, wake)
    }

    private async activeOf(workspaceId: string, agentId: string): Promise<ActiveFlow | null> {
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const flow = state?.active?.flow
        return flow === undefined || state?.activeVersionId == null
            ? null
            : { flow, versionId: state.activeVersionId, route: null }
    }
}
