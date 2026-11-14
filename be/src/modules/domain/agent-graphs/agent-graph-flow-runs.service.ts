import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { TriggerVerb } from "@nivo-lite/agent-sdk/names"
import { nodeSagaOf, type NodeIndex, type NodeSaga } from "@nivo-lite/agent-sdk/node"
import { installedStepIn, type InstalledStep } from "@modules/domain/installed-plugins"
import { mutatesBySpec } from "@modules/domain/tool-specs"
import { declaredPayloadOf, triggerSpecOf } from "@modules/domain/trigger-specs"
import { KEY_SCOPE_PREFIX } from "@modules/domain/provider-triggers/trigger-delivery.policy"
import { AgentRunsService, type StepSpec } from "@modules/domain/agent-runs"
import {
    AgentWorkHandlersService,
    type AgentHandlerEnding,
    type AgentTurnView,
    type AgentWakeView,
    type AgentWorkFlow,
    WAITING_REASON,
    handedBackOf,
    tagPayloadOf,
} from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { FlowTriggerScope } from "./agent-graphs.contracts"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphRawRowsService } from "./agent-graph-raw-rows.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentWorkflowRunsService, type HiddenTarget } from "./agent-workflow-runs.service"
import { AgentGraphSubjectHoldsService, type HoldingRun } from "./agent-graph-subject-holds.service"
import { AgentGraphCallGuardService, callerRunIdOf } from "./agent-graph-call-guard.service"
import { AgentGraphHoursGateService } from "./agent-graph-hours-gate.service"
import type { WorkflowRoute } from "./agent-workflows.contracts"
import { AgentGraphWakeNoticesService, type UntakenReason } from "./agent-graph-wake-notices.service"
import {
    GRAPH_FLOW_TRIGGER,
    graphNodeStepOf,
    namespaceOf,
    tagSourceOf,
    triggerScopeOf,
    type GraphNodeStepInput,
} from "./policies/graph-flow.policy"
import {
    CALLER_MEMBER,
    VERB_MEMBER,
    WAITING_MEMBER,
    personEventOf,
    pipelineVerbOf,
    takingTriggerOf,
    wakeVerbOf,
    workflowCallOf,
} from "./policies/workflow-trigger.policy"
import type { CallRefusal } from "./policies/workflow-call-guard.policy"

/** Why a customer wake started no run: no workflow of the agent took it. */
const NO_WORKFLOW = "no_workflow"

/** True when the flow found for a wake takes it: a workflow routed it, or the agent's own graph is triggered by its source. */
const takenBy = (active: ActiveFlow | null, turn: AgentTurnView): active is ActiveFlow =>
    active !== null && (active.route !== null || active.flow.trigger.sources.includes(tagSourceOf(turn)))

/** Why a customer's wake started no run: the agent is off duty and does not answer after hours; it waits for the next working hour. */
const OUTSIDE_HOURS = "outside_hours"

/** Why a hand-off started no run: the workflow it pinned is switched on but readiness hides it. */
const TARGET_HIDDEN: CallRefusal = "call_target_hidden"

/** The workflow a wake's plain data pins (an end hand-off, a founder's tag routed by the chat), or null for a wake no pin names. */
const pinOf = (turn: Pick<AgentWakeView, "context">) => workflowCallOf(tagPayloadOf(turn.context))

/**
 * Why a workflow call started no run and waits behind nothing (DEF-5): the run of its workflow in flight for its subject is the VERY run
 * that handed this line back (the line the call carries on). Queued behind it, the call would only run after that run ended, hours
 * later or never: it is ended at once and reported to the team instead.
 */
export const CALL_HANDED_BACK = "call_handed_back"

/** The id of the event a run's or a wake's context names: the key its intake stored it under, else the event's id; null for none. */
const eventIdOf = (context: object): string | null => {
    const key: unknown = Reflect.get(context, "messageKey")
    if (typeof key === "string" && key !== "") return key
    const id: unknown = Reflect.get(context, "eventId")
    return typeof id === "string" && id !== "" ? id : null
}

/** The runs that handed the event of a run's (or a wake's) context back (`handedBackJson`, written by the re-offer). */
const handersOf = (context: object): ReadonlyArray<string> => {
    const text: unknown = Reflect.get(context, "handedBackJson")
    return typeof text === "string" ? handedBackOf({ handedBackJson: text }) : []
}

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
 * starts (`setThreads`). It is the one engine: every run of every workflow is a thread, and a workflow wake that reaches the flow before
 * it registered fails loudly (`AGENT_GRAPHS_ENGINE_MISSING`), never runs on anything else.
 */
export interface FlowThreads {
    /** True when the wake is a thread's own (a founder's decision or a re-drive of a run): the flow hands it over and does nothing else. */
    owns(turn: AgentTurnView): boolean
    /** Marks the run just opened as a thread's, in the transaction that opened it. */
    opened(tx: EntityManager, workspaceId: string, runId: string): Promise<void>
    /** Starts the thread of the run under the wake's lease (or goes on with it when the wake is tried again) and answers how the wake ends. */
    started(run: FlowThreadRun, signal: AbortSignal): Promise<AgentHandlerEnding>
    /** Runs a wake the threads own, under its lease. */
    woken(turn: AgentTurnView, signal: AbortSignal): Promise<AgentHandlerEnding>
}

/**
 * The waits of the thread runs (`wait` steps parked on the same run): the flow asks them first whether an event is one a parked wait of
 * the wake's agent takes. Registered by the threads, so this module imports nothing of them.
 */
export interface FlowWaits {
    /** True when a parked wait took the event (its run resumes with it): the wake starts no run of its own. */
    took(turn: AgentTurnView, verb: string, trigger: FlowTriggerScope): Promise<boolean>
}

/** Why a wake started no run: a wait of a run parked on it took the event. */
export const WAIT_TOOK = "wait_took"

/** Why a wake started no run: it names no trigger verb (every wake carries one), so nothing may take it; the founder is told. */
const NO_TRIGGER_VERB = "no_trigger_verb"

/**
 * Why a wake started no run: its verb is one the agent hears only through a `wait` (no head trigger of its workflows takes it) and no
 * parked run took it (another render, a run that already timed out). A normal no-op: logged once, nobody is told.
 */
const NO_WAITER = "no_waiter"

/**
 * The SUBJECT of a pipeline wake's run (`SubjectRef` kind + id): the scope path and value of its correlation key, read from its lock
 * scope `key:<path>=<value>`; null for a keyless wake or a wake of another road (never serialised by subject).
 */
export const subjectOfScope = (turn: Pick<AgentTurnView, "scopeKey" | "context">): { readonly kind: string; readonly id: string } | null => {
    if (pipelineVerbOf(turn.context) === null || !turn.scopeKey.startsWith(KEY_SCOPE_PREFIX)) return null
    const rest = turn.scopeKey.slice(KEY_SCOPE_PREFIX.length)
    const at = rest.indexOf("=")
    return at <= 0 || at === rest.length - 1 ? null : { kind: rest.slice(0, at), id: rest.slice(at + 1) }
}

/** The subject kinds of a person the pipeline met (the scope paths a trigger keyed by subject or by contact declares). */
const ROUTE_SUBJECT = "routeId"
const CONTACT_SUBJECT = "contactId"

/** The member of a thread run's context that keeps the lock scope its wake ran under: every later drive of the thread takes that scope. */
export const THREAD_SCOPE_MEMBER = "threadScope"

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
const untakenReasonOf = (standing: {
    readonly total: number
    readonly running: ReadonlyArray<string>
}): UntakenReason => {
    if (standing.total === 0) return "no_workflow"
    return standing.running.length === 0 ? "no_workflow_running" : "no_trigger_takes_wake"
}

/**
 * The saga kind of a template node, by `nodeSagaOf`'s rule over its calls (forward only, R81): a write when it runs an effect or a call
 * that mutates (an installed tool that does not say `mutates: false`; a core tool the engine's registry says writes), else a read.
 */
const templateSagaOf = (step: InstalledStep, index: NodeIndex): NodeSaga => {
    const mutates = (call: string): boolean => {
        const tool = index.tools.get(call)
        return tool === undefined ? mutatesBySpec(call) !== false : tool.mutates !== false
    }
    const mutatingTool = step.tools.some((call) => !step.effects.includes(call) && mutates(call))
    return mutatingTool || step.effects.length > 0 ? "write" : "read"
}

@Injectable()
/**
 * Runs the wakes of an agent whose published graph is a node graph, with no model turn. It takes a wake when the active version holds a
 * flow whose tag trigger names where the wake came from, passes the gates (hours, the subject hold, call guard), opens the
 * wake's run and hands it to the thread runs, which drive it under the wake's lease.
 */
export class AgentGraphFlowRunsService implements AgentWorkFlow, OnModuleInit {
    /** The thread runs, once their capability registered; until then a workflow wake fails (`AGENT_GRAPHS_ENGINE_MISSING`). */
    private threads: FlowThreads | undefined

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly graphs: AgentGraphsService,
        private readonly runs: AgentRunsService,
        private readonly handlers: AgentWorkHandlersService,
        private readonly nodes: GraphNodeRegistryService,
        @Optional() private readonly workflows?: AgentWorkflowRunsService,
        @Optional() @InjectLogger() private readonly logger: Logger | null = null,
        @Optional() private readonly holds?: AgentGraphSubjectHoldsService,
        @Optional() private readonly calls?: AgentGraphCallGuardService,
        @Optional() private readonly hours?: AgentGraphHoursGateService,
        @Optional() private readonly wakeNotices?: AgentGraphWakeNoticesService,
        @Optional() private readonly installations?: InstallationRecordsService,
        @Optional() private readonly raw?: AgentGraphRawRowsService,
    ) {}

    /** Sets itself as the flow the drain asks before any handler, once the app has started. */
    onModuleInit(): void {
        this.handlers.setFlow(this)
    }

    /** Registers the thread runs: every run starts on a thread, and their own wakes are handed to them. */
    setThreads(threads: FlowThreads): void {
        this.threads = threads
    }

    /** Registers the waits of the thread runs: an event a parked wait takes resumes that run instead of starting one. */
    setWaits(waits: FlowWaits): void {
        this.waits = waits
    }

    /** The waits of the thread runs, once registered. */
    private waits: FlowWaits | undefined

    /**
     * The verb of a wake as its producer named it (`wakeVerbOf`: a pinned hand-off is `workflow.called`, any other wake what its channel,
     * provider trigger, tag source or road names), or null for a wake that names none: such a wake is unroutable.
     */
    private verbOf(turn: AgentTurnView): TriggerVerb | null {
        return wakeVerbOf(tagSourceOf(turn), triggerScopeOf(turn))
    }

    /**
     * Whether a parked wait of the wake's agent took the event of `verb`, with the wake's trigger scope and the members the verb declares;
     * false in an app with no waits.
     */
    private async waitTook(turn: AgentTurnView, verb: TriggerVerb): Promise<boolean> {
        if (this.waits === undefined) return false
        const scope = await this.triggerOf(turn)
        return this.waits.took(turn, verb, await this.withDeclaredPayload(turn, verb, scope))
    }

    /** Whether a `wait` step of an active workflow of the wake's agent lists the verb (what the agent hears beyond its head triggers). */
    private async waitsOn(turn: AgentTurnView, verb: TriggerVerb): Promise<boolean> {
        const waits = await this.workflows?.waitVerbsOf(turn.workspaceId, turn.agentId)
        return waits?.has(verb) === true
    }

    /**
     * Ends an event of a verb the agent hears only through a `wait` that no parked run took: nothing runs, one log line, nobody is told
     * (a render that completes after its run timed out, or another run's render, is a normal no-op, not an unroutable wake).
     */
    private noWaiter(turn: AgentTurnView, verb: TriggerVerb): AgentHandlerEnding {
        this.logger?.info(AgentGraphsLogEvent.WakeNoWaiter, { agentId: turn.agentId, wakeId: turn.wakeId, verb })
        return { status: "skipped", reason: NO_WAITER, outcome: null }
    }

    /**
     * Ends a wake that names no trigger verb: nothing is routed or run (no trigger may take it, whatever its road), it is logged and the
     * founder is told once per wake through the engine's wake report. Never a silent drop.
     */
    private async unroutable(turn: AgentTurnView): Promise<AgentHandlerEnding> {
        this.logger?.warn(AgentGraphsLogEvent.WakeUnroutable, { agentId: turn.agentId, wakeId: turn.wakeId, source: turn.source })
        await this.wakeNotices?.unroutable(turn)
        return { status: "skipped", reason: NO_TRIGGER_VERB, outcome: null }
    }

    /**
     * True when a workflow of the agent takes the wake (a trigger of it, or the pin of a hand-off), or its own graph is woken from
     * there. EVERY customer wake is this flow's, whatever the agent: workflows are the only thing that answers a customer, so an
     * agent with no workflow at all, one whose workflows take no such wake, and a routing that fails all end in `run` (which tells
     * the founder, or fails the wake). No turn outside a workflow exists to hand a customer to.
     */
    async takes(turn: AgentTurnView): Promise<boolean> {
        if (this.threads?.owns(turn) === true) return true
        // A wake of no verb is the flow's too: it starts nothing, and `run` tells the founder (no handler drops it in silence).
        const verb = this.verbOf(turn)
        if (verb === null) return true
        if (personEventOf(turn.context)) return true
        try {
            // An event of a verb only a `wait` of the agent lists is the flow's: a parked run may take it (`run` asks the waits first).
            return takenBy(await this.flowOf(turn), turn) || (await this.waitsOn(turn, verb))
        } catch (cause) {
            this.logger?.error(AgentGraphsLogEvent.WorkflowRouteFailed, cause, { agentId: turn.agentId })
            return true
        }
    }

    /**
     * A wake of this flow that failed for good (its tries are spent, or it could never run): the founder is told with the facts, in
     * place of any handler's own words. No workflow step exists to hand to the AI core or to stop on.
     */
    async stuck(turn: AgentTurnView, code: string): Promise<void> {
        // A hand-off to a workflow readiness hides is taken by nothing, so the drain asks for its common report: the founder is told the
        // refusal with what the workflow waits for, never "not ready" with no reason.
        const hidden = await this.hiddenTargetOf(turn)
        if (hidden !== null) return this.refuseHidden(turn, hidden)
        await this.wakeNotices?.failed(turn, code)
    }

    /** The workflow the wake's pin names when readiness hides it, or null (no pin, no routing, or a target that shows or is not active). */
    private async hiddenTargetOf(turn: AgentTurnView): Promise<HiddenTarget | null> {
        const pin = pinOf(turn)
        if (pin === null || this.workflows === undefined) return null
        return this.workflows.hiddenTargetOf(turn.workspaceId, turn.agentId, pin)
    }

    /**
     * Refuses a hand-off to a hidden workflow by the refused-call road: logged as a refused call with the providers it waits for, the
     * founder told once per wake, nothing run in its place. The calling run is not touched: its hand-off step already ended.
     */
    private async refuseHidden(turn: AgentTurnView, hidden: HiddenTarget): Promise<void> {
        this.logger?.warn(AgentGraphsLogEvent.CallRefused, {
            agentId: turn.agentId,
            wakeId: turn.wakeId,
            code: TARGET_HIDDEN,
            workflow: hidden.workflow,
            waitingFor: hidden.waitingFor.join(","),
        })
        await this.wakeNotices?.refused(turn, { code: TARGET_HIDDEN, workflow: hidden.name, waitingFor: hidden.waitingFor })
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
        const settled = ownGraph ? "no_trigger_takes_wake" : untakenReasonOf(standing)
        const reason = (await this.setupApplied(turn)) ? settled : "setup_not_applied"
        this.logger?.warn(AgentGraphsLogEvent.WakeUntaken, { agentId: turn.agentId, wakeId: turn.wakeId, code: reason })
        await this.wakeNotices?.untaken(turn, { reason, running: standing.running, sources: standing.sources })
        return { status: "skipped", reason: NO_WORKFLOW, outcome: null }
    }

    /**
     * False when the setup of the wake's agent was never applied (its installation holds no applied context version): such an agent
     * holds no primary workflow yet and answers no customer. True in an app that reads no installations, and for an agent of none.
     */
    private async setupApplied(turn: AgentTurnView): Promise<boolean> {
        const state = await this.graphs.stateOfAgent(turn.workspaceId, turn.agentId)
        const installation =
            state === null ? null : ((await this.installations?.findById(state.installationId)) ?? null)
        return installation === null || installation.activeContextVersionId !== null
    }

    /**
     * Opens the wake's run as a thread's and has the thread runs drive it under the wake's lease (`signal` aborts when the lease is
     * lost); a replay of the wake finds the run already there and the thread goes on. A wake the threads own goes straight to them.
     */
    async run(turn: AgentTurnView, signal: AbortSignal = new AbortController().signal): Promise<AgentHandlerEnding> {
        if (this.threads?.owns(turn) === true) return this.threads.woken(turn, signal)
        // Every wake carries a verb: one whose producer named none starts nothing, whatever its road, and is reported.
        const verb = this.verbOf(turn)
        if (verb === null) return this.unroutable(turn)
        // A run parked on a `wait` for this event takes it before any workflow does: the SAME run goes on, no run starts.
        if (await this.waitTook(turn, verb)) return { status: "done", reason: WAIT_TOOK, outcome: null }
        // A pipeline wake no registration took (delivered only because a `wait` of the agent lists its verb) that no parked run took: a
        // normal no-op, never a run and never a report (the registered graphs of the event have their own wakes).
        if (turn.context.waitOnly === "true") {
            // An event about a person that NO agent's registration took and no parked wait took started nothing anywhere: reported as
            // untaken (once per conversation), never a silent `no_waiter`. An event another agent's registration took stays a no-op here.
            if (turn.context.unclaimed === "true" && this.aboutAPerson(turn)) return this.untaken(turn)
            return this.noWaiter(turn, verb)
        }
        const active = await this.flowOf(turn)
        // A customer line is never dropped untold, whatever its agent waits on: no workflow taking it is reported.
        if (!takenBy(active, turn) && this.aboutAPerson(turn)) return this.untaken(turn)
        // An event no head registers, of a verb only a `wait` lists, that no parked run took: a normal no-op.
        if (!takenBy(active, turn) && (await this.waitsOn(turn, verb))) return this.noWaiter(turn, verb)
        if (active === null) {
            const hidden = await this.hiddenTargetOf(turn)
            if (hidden === null) return { status: "skipped", reason: "no_flow", outcome: null }
            await this.refuseHidden(turn, hidden)
            return { status: "skipped", reason: TARGET_HIDDEN, outcome: null }
        }
        if (active.flow.nodes[0] === undefined) return { status: "skipped", reason: "no_flow", outcome: null }
        const trigger = await this.withCaller(turn, {
            ...(await this.withDeclaredPayload(turn, verb, await this.triggerOf(turn))),
            ...(await this.triggerKeyOf(active, turn)),
        })
        if (await this.hours?.deferred(turn)) return { status: "held", reason: OUTSIDE_HOURS, outcome: null }
        // THE ONE HOLDING RULE (rule Q-1): a run that is not finished keeps its subject for EVERY workflow; an event of that subject, that
        // no wait took above, waits behind the oldest such run as a held wake and starts nothing. Never pushed into a started run.
        const holder = await this.holderOf(turn)
        const behind = holder?.id ?? (await this.inFlightBehind(turn, active))
        const handedBack = behind === null ? null : await this.handedBackBy(turn, behind)
        if (behind !== null && handedBack !== null) return this.callHandedBack(turn, active, behind, handedBack)
        if (behind !== null) return { status: "held", reason: `${WAITING_REASON}${behind}`, outcome: null }
        const waiting = (await this.holds?.waitingOf(turn.workspaceId, this.personOf(turn))) ?? []
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
        return this.threadRun(this.threadsOf(), turn, active, namespace, told, signal)
    }

    /**
     * True when the run `behind` (the subject's run of the wake's workflow, in flight) is the run that HANDED BACK the line this wake
     * carries: the wake's own event (a line re-offered by that run), or, for a workflow call, the event of the calling run (the run the
     * re-offered line started: its context keeps the hand-back list). Answers the context that names the hand-back (its event ids name the
     * line), or null. Ids of the engine's own records only, nothing of the line is read.
     */
    private async handedBackBy(turn: AgentTurnView, behind: string): Promise<object | null> {
        if (handersOf(turn.context).includes(behind)) return turn.context
        const callerRunId = callerRunIdOf(turn.context)
        if (callerRunId === null) return null
        const caller = await this.runs.runOf(turn.workspaceId, callerRunId)
        return caller !== null && handersOf(caller.context).includes(behind) ? caller.context : null
    }

    /**
     * Ends a call that would wait behind the run that handed its line back (DEF-5): no run, no hold, the team told once (the person, the
     * workflow it was for, the line's event, why). Never a wake that waits for a run that already said "not mine".
     */
    private async callHandedBack(turn: AgentTurnView, active: ActiveFlow, behind: string, line: object): Promise<AgentHandlerEnding> {
        this.logger?.warn(AgentGraphsLogEvent.CallRefused, { agentId: turn.agentId, wakeId: turn.wakeId, code: CALL_HANDED_BACK, behind })
        await this.wakeNotices?.lost(turn, {
            code: CALL_HANDED_BACK,
            workflow: active.route?.workflowKey ?? null,
            heldBy: behind,
            event: eventIdOf(line),
        })
        return { status: "skipped", reason: CALL_HANDED_BACK, outcome: null }
    }

    /**
     * The engine GAVE UP on a wake before any turn ran (`begin` found it dead past its attempts): a wake of the one pipeline or a workflow
     * call is the flow's, and the team is told (the person, the workflow it was for, the line's event, why); answers false for any other
     * wake (its handler tells) and in an app with no notices. Never a silent death (DEF-5).
     */
    async gaveUp(wake: AgentWakeView, code: string): Promise<boolean> {
        const pin = pinOf(wake)
        if (pipelineVerbOf(wake.context) === null && pin === null) return false
        if (this.wakeNotices === undefined) return false
        this.logger?.warn(AgentGraphsLogEvent.WakeGivenUp, { agentId: wake.agentId, wakeId: wake.wakeId, code })
        await this.wakeNotices.lost(wake, { code, workflow: pin?.workflow ?? null, heldBy: null, event: eventIdOf(wake.context) })
        return true
    }

    /** The thread runs; a workflow wake with none registered fails, so it is tried again and, at the end, told to the founder. */
    private threadsOf(): FlowThreads {
        if (this.threads === undefined) throw new AgentGraphsError({ code: AgentGraphsErrorCode.EngineMissing })
        return this.threads
    }

    /**
     * Opens the wake's run as a thread's (no step row is written: the thread writes its own steps) and hands it to the thread runs,
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
                // The run is labelled by the trigger id its delivered scope names (the pipeline verb, e.g. a channel's message trigger);
                // a wake of no pipeline (a tag) keeps the graph-flow label.
                trigger: pipelineVerbOf(turn.context) ?? GRAPH_FLOW_TRIGGER,
                versionId: active.versionId,
                context: { ...turn.context, [THREAD_SCOPE_MEMBER]: turn.scopeKey },
                subject: subjectOfScope(turn),
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
     * The trigger scope of a wake: a pipeline wake's generic scope (its data rebuilt from its raw row), a tag's the words its tagger gave.
     */
    async triggerOf(turn: AgentTurnView): Promise<FlowTriggerScope> {
        if (this.isPipeline(turn)) return this.pipelineScopeOf(turn)
        return triggerScopeOf(turn)
    }

    /** True for a wake about a person that nobody may drop untold (triggers rule 12): a pipeline event about a person on an account. */
    private aboutAPerson(turn: AgentTurnView): boolean {
        return personEventOf(turn.context)
    }

    /** The person a wake is about, as the pipeline met them: its contact and its route; none for a wake of another road. */
    private personOf(turn: AgentTurnView): { readonly contactId: string | null; readonly routeId: string | null } {
        const { contactId, conversationId } = turn.context
        return {
            contactId: typeof contactId === "string" && contactId !== "" ? contactId : null,
            routeId: typeof conversationId === "string" && conversationId !== "" ? conversationId : null,
        }
    }

    /**
     * The run that holds the wake's event (rule Q-1), or null. Its subjects: the wake's own key (its lock scope), its route and its contact.
     * Never the run the wake itself opened (a replay), nor a run that handed this very event back (it reaches the next waiter and the
     * registered graphs; a same-workflow run that handed it back is found by `inFlightBehind` and the call is ended there, DEF-5).
     */
    private async holderOf(turn: AgentTurnView): Promise<HoldingRun | null> {
        if (this.holds === undefined) return null
        const own = subjectOfScope(turn)
        const person = this.personOf(turn)
        const subjects = [
            ...(own === null ? [] : [own]),
            ...(person.routeId === null ? [] : [{ kind: ROUTE_SUBJECT, id: person.routeId }]),
            ...(person.contactId === null ? [] : [{ kind: CONTACT_SUBJECT, id: person.contactId }]),
        ].filter((one, at, all) => all.findIndex((other) => other.kind === one.kind && other.id === one.id) === at)
        if (subjects.length === 0) return null
        const replayed = turn.attempts > 1 ? await this.runs.runIdOfWake(turn.workspaceId, turn.wakeId) : null
        const skipped = new Set([...handersOf(turn.context), ...(replayed === null ? [] : [replayed])])
        return this.holds.holderOf(turn.workspaceId, subjects, person, skipped)
    }

    /**
     * The run of the wake's workflow still in flight for the wake's subject (its `key:<path>=<value>` lock scope), other than the run the
     * wake itself opened (a replay), or null: a keyless wake, a wake of no workflow, or none in flight.
     */
    private async inFlightBehind(turn: AgentTurnView, active: ActiveFlow): Promise<string | null> {
        const workflowId = active.route?.workflowId
        const subject = subjectOfScope(turn)
        if (workflowId === undefined || subject === null) return null
        const run = await this.runs.inFlightOf(turn.workspaceId, workflowId, subject)
        if (run === null) return null
        const own = turn.attempts > 1 ? await this.runs.runIdOfWake(turn.workspaceId, turn.wakeId) : null
        return run.id === own ? null : run.id
    }

    /** True for a wake of the one event pipeline: its producer named its verb in the wake (`deliver`). */
    private isPipeline(turn: AgentTurnView): boolean {
        return pipelineVerbOf(turn.context) !== null
    }

    /**
     * The GENERIC trigger scope of a wake of the one event pipeline (lane concept triggers rule 13; ROAD-API section 3.1): the event's id,
     * the account, the person and the route the engine met, and the event's data rebuilt from its raw row (or carried, for a source that
     * keeps none), with the run's language. No channel, conversation, front door or flag member: what a graph wants of the event it reads
     * in `data`.
     */
    private async pipelineScopeOf(turn: AgentTurnView): Promise<FlowTriggerScope> {
        const { eventId, connectionId, contactId, conversationId, locale } = turn.context
        const event = (await this.raw?.pipelineEventOf(turn)) ?? { data: {} }
        return {
            eventId: eventId ?? "",
            ...(connectionId === undefined ? {} : { accountId: connectionId }),
            ...(contactId === undefined ? {} : { contactId }),
            ...(conversationId === undefined ? {} : { routeId: conversationId }),
            ...(event.subject === undefined ? {} : { subject: event.subject }),
            data: event.data,
            ...(locale === undefined ? {} : { locale }),
            ...this.callerScopeOf(turn),
        }
    }

    /**
     * A workflow call of the pipeline names who called (ROAD-API 3.1 `caller`, `workflow.called` only): the calling agent and run, read
     * from its wake (`authorAgentId`, the call's `caller.runId`); `withCaller` adds the caller's workflow. Nothing for any other event.
     */
    private callerScopeOf(turn: AgentTurnView): Readonly<Record<string, unknown>> {
        if (pinOf(turn) === null) return {}
        const agent = turn.context.authorAgentId ?? null
        const runId = callerRunIdOf(turn.context)
        return agent === null && runId === null ? {} : { [CALLER_MEMBER]: { agent, workflow: null, runId } }
    }

    /**
     * The scope a wake is ROUTED by: a pipeline wake's generic scope with its verb (the registrations' `where` reads `data.*`), any other
     * wake's scope as its door wrote it.
     */
    private async routingScopeOf(turn: AgentTurnView): Promise<Readonly<Record<string, unknown>>> {
        if (!this.isPipeline(turn)) return triggerScopeOf(turn)
        return { ...(await this.pipelineScopeOf(turn)), [VERB_MEMBER]: turn.context.verb }
    }

    /**
     * The trigger scope with the members its verb DECLARES filled from the stored row its event's id names (`TriggerSpec.reads`: the
     * bank credit's amount, content, time, account and bank reference from the `<provider>.transaction` row of every bank feed): read
     * among the account data types of the declared purpose, only a row of one of the workspace's own connections, each field as stored
     * (`declaredPayloadOf`). The wake carries ids only; a member the run already holds is never replaced. Nothing is filled in an app with
     * no account store, for a verb that declares no read, or when no row of the id is found.
     */
    private async withDeclaredPayload(turn: AgentTurnView, verb: TriggerVerb, scope: FlowTriggerScope): Promise<FlowTriggerScope> {
        // A pipeline event's data is its declaration's translate of the stored row already: nothing is filled beside it.
        if (this.isPipeline(turn)) return scope
        const reads = triggerSpecOf(verb)?.reads
        if (reads === undefined) return scope
        const id: unknown = Reflect.get(scope, reads.member)
        if (typeof id !== "string" || id === "") return scope
        const row = (await this.raw?.rowOf(turn.workspaceId, reads.purpose, id)) ?? null
        return row === null ? scope : { ...declaredPayloadOf(verb, row), ...scope }
    }

    /** The key of the trigger of the workflow that took the wake, as `trigger.triggerKey`; nothing for a graph without typed triggers. */
    private async triggerKeyOf(active: ActiveFlow, turn: AgentTurnView): Promise<Readonly<Record<string, string>>> {
        const key = takingTriggerOf(active.flow, tagSourceOf(turn), await this.routingScopeOf(turn))
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

    /**
     * The step of a node, with its saga kind: a read, compensable when every effect it runs can be undone, else a pivot. A template
     * node is judged by the same rule on its calls (`templateSagaOf`), read through the one installed-step view.
     */
    stepOf(node: GraphSpecNode, input: GraphNodeStepInput): StepSpec {
        const installed = this.nodes.installed()
        const definition = installed.nodes.get(node.step)
        const step = installedStepIn(installed.nodes, node.step)
        const saga =
            step?.form === "template"
                ? templateSagaOf(step, installed)
                : definition === undefined
                  ? "read"
                  : nodeSagaOf(definition, installed)
        return graphNodeStepOf(node, input, saga)
    }

    /**
     * The flow a wake runs: the workflow `AgentWorkflowsService.route` sends it to, pinned to that workflow's version. When none takes
     * it, the agent's own active node graph answers, unpinned, ONLY for a wake no hand-off pinned of an agent that holds no workflow at
     * all (a legacy agent with a graph of its own, or an app with no workflows): a pinned hand-off names one workflow and goes nowhere
     * else (a hidden or inactive target runs nothing), and an agent that holds workflows never answers outside them, whatever the wake
     * (a channel line, a schedule, a provider trigger, a team chat line, an agent's tag). That keeps readiness the one gate: a workflow it
     * hides is never run as the agent's own graph.
     */
    private async flowOf(turn: AgentTurnView): Promise<ActiveFlow | null> {
        const route = await this.routeOf(turn)
        if (route !== null) return { flow: route.flow, versionId: route.versionId, route }
        return (await this.ownGraphAnswers(turn)) ? this.activeOf(turn.workspaceId, turn.agentId) : null
    }

    /** Whether the agent's own graph may answer a wake no workflow took: never a pinned one, never one of an agent that holds workflows. */
    private async ownGraphAnswers(turn: AgentTurnView): Promise<boolean> {
        if (this.workflows === undefined) return true
        if (pinOf(turn) !== null) return false
        return !(await this.workflows.holdsWorkflows(turn.workspaceId, turn.agentId))
    }

    private async routeOf(turn: AgentTurnView): Promise<WorkflowRoute | null> {
        if (this.workflows === undefined) return null
        const scope = await this.routingScopeOf(turn)
        const wake = { source: tagSourceOf(turn), scope, pin: pinOf(turn) }
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
