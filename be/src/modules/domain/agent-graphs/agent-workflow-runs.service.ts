import { Injectable, Optional } from "@nestjs/common"
import { LATEST_VERSION, type GraphSpec, type WorkflowCallPin, type WorkflowTrigger } from "@nivo-lite/agent-sdk/graph"
import { TRIGGER_WAKE_SOURCE } from "@modules/domain/provider-triggers/trigger-delivery.policy"
import type { EntityManager } from "typeorm"
import { ConnectionBindingsReadService, connectionAttentionOf } from "@modules/domain/connections"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { accountsAsNodesName } from "@modules/domain/tools"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { OPENAPI_PROVIDER, OPENAPI_SOURCE_KEYS, installedDeclarationsOf, pinnedOpsOf } from "@modules/domain/openapi-tools"
import { InjectTriggerSwitchReader, type TriggerSwitchReader, type TriggerSwitchRow } from "@modules/domain/trigger-specs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder, isRecord, parseJsonText } from "@modules/platform/primitives"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowStoreService, WORKFLOW_LIMIT } from "./agent-workflow-store.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type {
    OptionalWorkflowRoute,
    RoutableWorkflow,
    RouteWake,
    RunPinView,
    WorkflowRoute,
    WorkflowVersionRecord,
} from "./agent-workflows.contracts"
import { tagSourceOf, triggerScopeOf, type FlowWake } from "./policies/graph-flow.policy"
import {
    graphReadinessOf,
    sideNodeWaitingOf,
    type GraphReadiness,
    type ReadinessBlock,
    type ReadinessInput,
    type ReadinessNode,
    type ReconnectNeed,
} from "./policies/graph-readiness.policy"
import {
    listensThroughSwitch,
    triggerBindingOf,
    triggerFiringOf,
    triggerReadinessOf,
    type TriggerBinding,
    type TriggerReadinessFacts,
} from "./policies/trigger-readiness.policy"
import { workflowRouteOf } from "./policies/workflow-route.policy"
import { VERB_MEMBER, pipelineVerbOf, takingTriggerOf, waitVerbsOf } from "./policies/workflow-trigger.policy"
import { snapshotOf } from "./policies/workflow-view.policy"
import { WorkflowTriggerPicksService, type WorkflowTriggerPickWrite } from "./workflow-trigger-picks.service"

/** The most versions looked through for the one a hand-off pinned. */
const VERSION_SCAN = 500

/** An active workflow with the version it runs. */
interface Running {
    /** The workflow's key, what a hand-off names. */
    readonly key: string
    /** The workflow's name, as the owner reads it. */
    readonly name: string
    readonly workflow: RoutableWorkflow
    readonly version: WorkflowVersionRecord
    /** How its triggers bind to the workspace's accounts (one source per stream); absent: read for none (nothing is muted). */
    readonly binding?: TriggerBinding | undefined
}

/** A workflow's readiness and, when its triggers were bound, the binding the takers read. */
interface Judged {
    readonly readiness: GraphReadiness
    readonly binding?: TriggerBinding | undefined
}

/** How the primary workflow of an agent, which has no key, is named among the running ones. */
const PRIMARY_NAME = "primary"

/**
 * A sample wake as MATCH judges it: a wake of the one event pipeline (it names its verb) by its verb and its event's `data` (the
 * `dataJson` the delivery writes for a source that keeps no raw row: a timer, a clock slot, a call), as `takerOfEvent` reads it; any
 * other wake by its scope as its door wrote it.
 */
const sampleRouteWakeOf = (wake: FlowWake): RouteWake => {
    const verb = pipelineVerbOf(wake.context)
    if (verb === null) return { source: tagSourceOf(wake), scope: triggerScopeOf(wake), pin: null }
    const read = wake.context.dataJson === undefined ? null : parseJsonText(wake.context.dataJson)
    const data: unknown = read?.ok === true ? read.value : null
    return { source: TRIGGER_WAKE_SOURCE, scope: { [VERB_MEMBER]: verb, data: isRecord(data) ? data : {} }, pin: null }
}

/** The workflow whose registration takes an event of the one event pipeline: its id, the registration, and the graph it runs. */
export interface EventTaker {
    /** The workflow id. */
    readonly workflowId: string
    /** The registration (the head trigger) that takes the event. */
    readonly registration: WorkflowTrigger
    /** The graph the workflow runs (its snapshot). */
    readonly flow: GraphSpec
}

/** The workflow a wake would go to: its id, its key (`primary` for the agent's main one) and its name. */
export interface WorkflowTaker {
    /** The workflow id. */
    readonly workflowId: string
    /** Its key within the agent. */
    readonly key: string
    /** Its name. */
    readonly name: string
}

/** A workflow a hand-off pinned that the agent switched on but readiness hides, with what it waits for. */
export interface HiddenTarget {
    /** The key the pin named. */
    readonly workflow: string
    /** The workflow's name, as the owner reads it. */
    readonly name: string
    /** The providers it waits for, distinct. */
    readonly waitingFor: ReadonlyArray<string>
    /** Why each is missing. */
    readonly blocked: ReadonlyArray<ReadinessBlock>
}

/** The workflows of an agent as a wake finds them. */
export interface WorkflowStanding {
    /** How many workflows the agent has, running or not. */
    readonly total: number
    /** The running ones, by key. */
    readonly running: ReadonlyArray<string>
    /** The sources that trigger the running ones. */
    readonly sources: ReadonlyArray<string>
}

@Injectable()
/**
 * Where a wake goes among the agent's workflows and how its run is pinned: the run engine runs the snapshot of the chosen version, and
 * the pin (one per run, written in the transaction that opens it) lets the runs list filter by workflow and the run detail name it.
 */
export class AgentWorkflowRunsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly records: AgentWorkflowRecordsService,
        private readonly store: AgentWorkflowStoreService,
        private readonly adoption: AgentWorkflowAdoptionService,
        @Optional() private readonly access?: AccountAttachmentsService,
        @Optional() @InjectLogger() private readonly logger?: Logger,
        @Optional() @InjectTriggerSwitchReader() private readonly switches?: TriggerSwitchReader,
        @Optional() private readonly bindings?: ConnectionBindingsReadService,
        @Optional() private readonly picks?: WorkflowTriggerPicksService,
    ) {}

    /**
     * The workflow a wake goes to: the one an end hand-off pinned (by key and version), else the narrowest active workflow one of whose
     * triggers takes the wake (its source kind, channel, connection and conditions), with the snapshot the run
     * executes and the id its steps read their graph by: the agent graph version for the primary workflow (kept in step with it first),
     * the workflow version for any other. Null when no workflow takes the wake; the flow then answers it with the agent's own graph
     * only for an agent that holds no workflow at all and a wake no hand-off pinned (`AgentGraphFlowRunsService.flowOf`).
     */
    async route(workspaceId: string, agentId: string, wake: RouteWake): Promise<OptionalWorkflowRoute> {
        await this.adoption.adoptAgentGraph(workspaceId, agentId)
        return this.engine.scoped(workspaceId, async (tx) => {
            const running = await this.runningOf(tx, workspaceId, agentId)
            const found = wake.pin === null ? this.takerOf(running, wake) : await this.pinnedOf(tx, running, wake.pin)
            if (found === undefined) return null
            const { version } = found
            return {
                agentId,
                workflowId: found.workflow.id,
                ...(found.workflow.key === undefined ? {} : { workflowKey: found.workflow.key }),
                versionId: version.graphVersionId ?? version.id,
                workflowVersionId: version.id,
                workflowVersion: version.number,
                flow: snapshotOf(version),
            }
        })
    }

    /**
     * The workflows of an agent as a wake finds them: how many it has at all, and the running ones with the sources that trigger
     * them. An agent with at least one workflow runs on workflows: its wakes are never answered outside them.
     */
    standingOf(workspaceId: string, agentId: string): Promise<WorkflowStanding> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const all = await this.records.workflowsOf(tx, agentId, WORKFLOW_LIMIT)
            const running = await this.runningOf(tx, workspaceId, agentId)
            return {
                total: all.length,
                running: running.map((one) => one.key ?? PRIMARY_NAME),
                sources: [...new Set(running.flatMap((one) => one.workflow.sources))],
            }
        })
    }

    /**
     * The verbs the agent hears through a `wait` step (`waitVerbsOf`) of any of its ACTIVE workflows, shown or hidden: a run parked in a
     * workflow readiness hides now still waits for its event. With the head triggers (`takersOf`) this is what the agent listens to: an
     * event of such a verb is delivered to it even when no head registers the verb, and only a parked run's wait may take it.
     */
    waitVerbsOf(workspaceId: string, agentId: string): Promise<ReadonlySet<string>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const active = await this.activeOf(tx, agentId)
            return new Set(active.flatMap((entry) => waitVerbsOf(snapshotOf(entry.version))))
        })
    }

    /**
     * True when the agent holds at least one workflow, in any status: such an agent runs on workflows, and a wake none of them takes is
     * answered by nothing (never by the agent's own graph, unpinned). False for an agent that only runs a graph of its own.
     */
    holdsWorkflows(workspaceId: string, agentId: string): Promise<boolean> {
        return this.engine.scoped(workspaceId, async (tx) => (await this.records.workflowsOf(tx, agentId, 1)).length > 0)
    }

    /**
     * The workflow a hand-off pinned when the agent switched it on but readiness HIDES it (a blocking node none of whose providers is
     * bound), with the providers it waits for; null when the pin names no active workflow, or one that shows. What the flow refuses the
     * hand-off with and tells the founder, since `route` (through `runningOf`) never reaches a hidden workflow.
     */
    hiddenTargetOf(workspaceId: string, agentId: string, pin: WorkflowCallPin): Promise<HiddenTarget | null> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const named = (await this.activeOf(tx, agentId)).find((entry) => entry.key === pin.workflow)
            if (named === undefined) return null
            const readiness = (await this.readinessOfAll(workspaceId, agentId, [named])).get(named.workflow.id)
            return readiness?.hidden === true
                ? { workflow: pin.workflow, name: named.name, waitingFor: readiness.waitingFor, blocked: readiness.blocked }
                : null
        })
    }

    /**
     * The key of the workflow a run executes, from its pin; null for a run of no workflow. What a hand-off's target reads as
     * `trigger.caller.workflow`.
     */
    workflowKeyOfRun(workspaceId: string, runId: string): Promise<string | null> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const [pin] = await this.records.pinsOf(tx, [runId])
            if (pin === undefined) return null
            return (await this.records.workflow(tx, pin.workflowId))?.key ?? null
        })
    }

    /**
     * The active workflow each of these wakes would go to, read only (no adoption, no pin: a wake not written yet), as `route` picks it;
     * null where none takes it. What a list of the agent's scheduled work names ("which workflow it will wake").
     */
    takersOf(workspaceId: string, agentId: string, wakes: ReadonlyArray<FlowWake>): Promise<ReadonlyArray<WorkflowTaker | null>> {
        if (wakes.length === 0) return Promise.resolve([])
        return this.engine.scoped(workspaceId, async (tx) => {
            const running = await this.runningOf(tx, workspaceId, agentId)
            return wakes.map((wake) => {
                const found = this.takerOf(running, sampleRouteWakeOf(wake))
                return found === undefined
                    ? null
                    : { workflowId: found.workflow.id, key: found.key ?? PRIMARY_NAME, name: found.name }
            })
        })
    }

    /**
     * The active workflow one of whose triggers takes the wake, as `workflowRouteOf` picks among them (narrowest, primary, first); a wake
     * of an account a workflow's binding mutes (one source per stream: not the founder's pick) is taken by none of its triggers.
     */
    private takerOf(running: ReadonlyArray<Running>, wake: RouteWake): Running | undefined {
        const takers = running.filter(
            (entry) => takingTriggerOf(snapshotOf(entry.version), wake.source, wake.scope, entry.binding) !== null,
        )
        // An event of the one event pipeline names its verb: the takers are the registrations on that verb, and triggers rule 3 keeps
        // their `where` disjoint, so at most one takes it; the first in the agent's order answers (no tag source is compared).
        if (pipelineVerbOf(wake.scope) !== null) return takers[0]
        const chosen = workflowRouteOf(
            takers.map((entry) => entry.workflow),
            wake.source,
        )
        return takers.find((entry) => entry.workflow.id === chosen)
    }

    /**
     * MATCH (stage 4 of the one event pipeline, lane concept triggers rule 13): the active workflow of the agent whose registration takes
     * an event of `verb` with this generic scope (verb, account binding, `where`), with the registration itself and the graph it runs;
     * null when none does. Read only, as `takersOf`.
     */
    takerOfEvent(
        workspaceId: string,
        agentId: string,
        verb: string,
        scope: Readonly<Record<string, unknown>>,
        onlyWorkflowId: string | null = null,
        onlyWorkflowKey: string | null = null,
    ): Promise<EventTaker | null> {
        return this.engine.scoped(workspaceId, async (tx) => {
            // An engine source that names the workflow it fired for (the clock's row) is matched among that workflow's registrations only.
            const all = await this.runningOf(tx, workspaceId, agentId)
            // A call pinned to a workflow (its key) is matched among that workflow's registrations only: it starts that one or none.
            const running = all.filter(
                (entry) =>
                    (onlyWorkflowId === null || entry.workflow.id === onlyWorkflowId) &&
                    (onlyWorkflowKey === null || entry.key === onlyWorkflowKey),
            )
            const wake: RouteWake = { source: TRIGGER_WAKE_SOURCE, scope: { ...scope, [VERB_MEMBER]: verb }, pin: null }
            const found = this.takerOf(running, wake)
            if (found === undefined) return null
            const flow = snapshotOf(found.version)
            const key = takingTriggerOf(flow, wake.source, wake.scope, found.binding)
            const registration = flow.triggers?.find((one) => one.key === key) ?? null
            return registration === null ? null : { workflowId: found.workflow.id, registration, flow }
        })
    }

    /**
     * The workflow an end hand-off named, by key, at the version it pinned (`latest` is the version the workflow runs now). A workflow
     * that is not active takes no hand-off: the wake goes nowhere rather than to another workflow.
     */
    private async pinnedOf(
        tx: ScopedTx,
        running: ReadonlyArray<Running>,
        pin: WorkflowCallPin,
    ): Promise<Running | undefined> {
        const named = running.find((entry) => entry.key === pin.workflow)
        if (named === undefined || pin.version === LATEST_VERSION) return named
        const versions = await this.records.versionsOf(tx, named.workflow.id, VERSION_SCAN)
        const pinned = versions.find((version) => version.number === pin.version)
        return pinned === undefined ? undefined : { ...named, version: pinned }
    }

    /** Pins a run to the workflow version it executes, in the transaction that opens the run; a replay writes nothing. */
    pinRun(manager: EntityManager, workspaceId: string, runId: string, route: WorkflowRoute): Promise<void> {
        return this.engine.within(manager, workspaceId, (tx) =>
            this.records.pinRun(tx, {
                runId,
                agentId: route.agentId,
                workflowId: route.workflowId,
                workflowVersionId: route.workflowVersionId,
                workflowVersion: route.workflowVersion,
            }),
        )
    }

    /** The workflow and version each of these runs executes, with the workflow's name; a run of no workflow is left out. */
    pinsOf(workspaceId: string, runIds: ReadonlyArray<string>): Promise<ReadonlyArray<RunPinView>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const pins = await this.records.pinsOf(tx, runIds)
            const names = new Map<string, string>()
            await eachInOrder([...new Set(pins.map((pin) => pin.workflowId))], async (workflowId) => {
                const workflow = await this.records.workflow(tx, workflowId)
                if (workflow !== null) names.set(workflowId, workflow.name)
            })
            return pins.map((pin) => ({
                runId: pin.runId,
                workflowId: pin.workflowId,
                workflowName: names.get(pin.workflowId) ?? "",
                version: pin.workflowVersion,
            }))
        })
    }

    /**
     * THE ONE CHOKE POINT of readiness: the agent's active workflows that SHOW, with the version each runs and the sources its graph
     * wakes on. A workflow whose running graph is hidden (`graphReadinessOf`: a blocking node none of whose providers is bound) is left
     * out, so no wake routes to it, no hand-off reaches it, no trigger taker names it and the standing does not count it as running.
     */
    private async runningOf(tx: ScopedTx, workspaceId: string, agentId: string): Promise<ReadonlyArray<Running>> {
        const all = await this.activeOf(tx, agentId)
        const judged = await this.judgedOfAll(workspaceId, agentId, all)
        return all.flatMap((entry) => {
            const one = judged.get(entry.workflow.id)
            if (one?.readiness.hidden === true) return []
            return one?.binding === undefined ? [entry] : [{ ...entry, binding: one.binding }]
        })
    }

    /**
     * The founder's picks of the ONE source of a contested stream (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12), checked
     * before anything is written: each names an active workflow of the agent and a stream that two or more of the agent's attached
     * accounts read for that purpose (`triggerBindingOf` with no pick: the stream is contested), and an account among them. Any other is
     * refused `TRIGGER_PICK_REFUSED` and the whole list with it. Answers the picks to write (`WorkflowTriggerPicksService.record`).
     */
    async triggerPicksOf(
        workspaceId: string,
        agentId: string,
        picks: ReadonlyArray<WorkflowTriggerPickWrite>,
    ): Promise<ReadonlyArray<WorkflowTriggerPickWrite>> {
        if (picks.length === 0) return []
        const active = await this.engine.scoped(workspaceId, (tx) => this.activeOf(tx, agentId))
        const contested = new Map<string, TriggerBinding["contested"]>()
        for (const pick of picks) {
            const entry = active.find((one) => one.workflow.id === pick.workflowId)
            if (entry === undefined) throw new AgentGraphsError({ code: AgentGraphsErrorCode.TriggerPickRefused })
            const held = contested.get(pick.workflowId) ?? (await this.contestedOf(workspaceId, agentId, entry))
            contested.set(pick.workflowId, held)
            const stream = held.find((one) => one.verb === pick.verb && one.stream === pick.stream)
            if (stream?.accounts.some((account) => account.connectionId === pick.connectionId) !== true)
                throw new AgentGraphsError({ code: AgentGraphsErrorCode.TriggerPickRefused })
        }
        return picks.map(({ workflowId, verb, stream, connectionId }) => ({ workflowId, verb, stream, connectionId }))
    }

    /** Writes the founder's checked picks (`triggerPicksOf`); answers how many were written, none in an app with no pick store. */
    async recordTriggerPicks(
        workspaceId: string,
        agentId: string,
        memberId: string,
        picks: ReadonlyArray<WorkflowTriggerPickWrite>,
    ): Promise<number> {
        return (await this.picks?.record(workspaceId, agentId, memberId, picks)) ?? 0
    }

    /** The streams a workflow's attached accounts contest with no pick at all: what a pick may name. */
    private async contestedOf(workspaceId: string, agentId: string, entry: Running): Promise<TriggerBinding["contested"]> {
        const input = await this.readinessInputOf(workspaceId, agentId, entry.workflow.id)
        if (input === null) return []
        const facts = await this.triggerFactsOf(workspaceId, input.attachments, new Map(), new Map())
        return triggerBindingOf(snapshotOf(entry.version), facts).contested
    }

    /** The agent's active workflows with the version each runs and the sources its graph wakes on, shown or hidden. */
    private async activeOf(tx: ScopedTx, agentId: string): Promise<ReadonlyArray<Running>> {
        const found: Array<Running> = []
        const active = (await this.records.workflowsOf(tx, agentId, WORKFLOW_LIMIT)).filter(
            (workflow) => workflow.status === "active",
        )
        await eachInOrder(active, async (workflow) => {
            const version = await this.store.runningOf(tx, workflow)
            if (version === null) return
            found.push({
                key: workflow.key,
                name: workflow.name,
                workflow: { ...workflow, sources: [...snapshotOf(version).trigger.sources] },
                version,
            })
        })
        return found
    }

    /**
     * The readiness of each workflow of these ids (what the agent page reads), by the graph its running version (else its newest)
     * runs; a workflow with no version, or not of the workspace, is left out.
     */
    readinessOf(workspaceId: string, workflowIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, GraphReadiness>> {
        if (workflowIds.length === 0) return Promise.resolve(new Map())
        return this.engine.scoped(workspaceId, async (tx) => {
            const byAgent = new Map<string, Array<Running>>()
            await eachInOrder([...new Set(workflowIds)], async (workflowId) => {
                const workflow = await this.records.workflow(tx, workflowId)
                if (workflow === null) return
                const version = await this.store.runningOf(tx, workflow)
                if (version === null) return
                const entry: Running = {
                    key: workflow.key,
                    name: workflow.name,
                    workflow: { ...workflow, sources: [...snapshotOf(version).trigger.sources] },
                    version,
                }
                byAgent.set(workflow.agentId, [...(byAgent.get(workflow.agentId) ?? []), entry])
            })
            const found = new Map<string, GraphReadiness>()
            await eachInOrder([...byAgent.entries()], async ([agentId, entries]) => {
                const read = await this.readinessOfAll(workspaceId, agentId, entries)
                const reconnect = await this.reconnectOf(workspaceId, agentId)
                for (const entry of entries) {
                    const own = read.get(entry.workflow.id) ?? { hidden: false, skipped: [] }
                    found.set(entry.workflow.id, reconnect.length === 0 ? own : { ...own, reconnect })
                }
            })
            return found
        })
    }

    /**
     * The agent's attached accounts whose provider refused the credential (`needs_reauth`, as the poll scheduler recorded it): none where
     * nothing can be read (no grant store, no connection reader, a read that failed: logged). Informative: it never hides a graph.
     */
    private async reconnectOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<ReconnectNeed>> {
        const { access, bindings } = this
        if (access === undefined || bindings === undefined) return []
        try {
            const attached = await access.listOfAgent(workspaceId, agentId)
            const needs: Array<ReconnectNeed> = []
            await eachInOrder(attached, async (one) => {
                const record = await bindings.recordOf(workspaceId, one.connectionId)
                if (record !== null && connectionAttentionOf(record) === "needs_reauth")
                    needs.push({ provider: one.provider, connectionId: one.connectionId })
            })
            return needs
        } catch (cause: unknown) {
            this.logger?.error(AgentGraphsLogEvent.NodeRightsUnreadable, cause, { workspaceId, agentId })
            return []
        }
    }

    /**
     * The providers one SIDE node of a run's workflow waits for when none of them is bound (the run passes it over and names them), or
     * null when it runs: a blocking node, a node that lists no accounts, or one of whose providers is bound. Null too where readiness
     * cannot be read: the step then runs exactly as before readiness.
     */
    async sideNodeWaiting(
        scope: { readonly workspaceId: string; readonly agentId: string; readonly workflowId: string | null },
        node: ReadinessNode,
    ): Promise<ReadonlyArray<string> | null> {
        if (node.accounts === undefined) return null
        // A blocking node is never skipped: nothing is read for it (a blocking node with no provider hides its whole graph instead).
        if ((node.blocking ?? (node.step === undefined ? undefined : this.blockingOf(node.step))) !== false) return null
        const input = await this.readinessInputOf(scope.workspaceId, scope.agentId, scope.workflowId)
        return input === null ? null : sideNodeWaitingOf(node, input)
    }

    /**
     * The readiness of each of an agent's workflows by its running graph, its trigger side composed in (`triggerFiringOf`: a graph none
     * of whose triggers can fire is hidden the same way); nothing is read when no node of them lists accounts and none listens through
     * an account trigger switch.
     */
    private async readinessOfAll(
        workspaceId: string,
        agentId: string,
        entries: ReadonlyArray<Running>,
    ): Promise<ReadonlyMap<string, GraphReadiness>> {
        const judged = await this.judgedOfAll(workspaceId, agentId, entries)
        return new Map([...judged.entries()].map(([workflowId, one]) => [workflowId, one.readiness]))
    }

    /**
     * `readinessOfAll` with the binding of each workflow's triggers to the agent's accounts (`triggerBindingOf`, one source per stream),
     * read where a graph listens through an account trigger switch: the accounts' public facts name their streams, and the founder's
     * picks are read only for a workflow whose accounts contest a stream (a pick store that cannot be read is logged and picks nothing:
     * the contested stream keeps the graph hidden, the engine never picks).
     */
    private async judgedOfAll(
        workspaceId: string,
        agentId: string,
        entries: ReadonlyArray<Running>,
    ): Promise<ReadonlyMap<string, Judged>> {
        const declaring = entries.filter((entry) => {
            const graph = snapshotOf(entry.version)
            return (
                graph.nodes.some((node) => node.accounts !== undefined) ||
                listensThroughSwitch(graph)
            )
        })
        if (declaring.length === 0) return new Map()
        const found = new Map<string, Judged>()
        const switches = new Map<string, ReadonlyArray<TriggerSwitchRow> | null>()
        const facts = new Map<string, Readonly<Record<string, string>>>()
        await eachInOrder(declaring, async (entry) => {
            const input = await this.readinessInputOf(workspaceId, agentId, entry.workflow.id)
            if (input === null) return
            const graph = snapshotOf(entry.version)
            if (!listensThroughSwitch(graph)) {
                found.set(entry.workflow.id, { readiness: graphReadinessOf(graph, input) })
                return
            }
            const read = await this.triggerFactsOf(workspaceId, input.attachments, switches, facts)
            const unpicked = triggerBindingOf(graph, read)
            const bound =
                unpicked.contested.length === 0
                    ? read
                    : { ...read, picks: await this.picksOf(workspaceId, agentId, entry.workflow.id) }
            const binding = bound === read ? unpicked : triggerBindingOf(graph, bound)
            const triggers = triggerReadinessOf(triggerFiringOf(graph, bound))
            found.set(entry.workflow.id, { readiness: graphReadinessOf(graph, { ...input, triggers }), binding })
        })
        return found
    }

    /** What the trigger side reads of the agent's accounts: their switches and their public facts (each read once per call). */
    private async triggerFactsOf(
        workspaceId: string,
        attachments: ReadonlyArray<{ readonly connectionId: string; readonly provider: string }>,
        switches: Map<string, ReadonlyArray<TriggerSwitchRow> | null>,
        facts: Map<string, Readonly<Record<string, string>>>,
    ): Promise<TriggerReadinessFacts> {
        return {
            attachments,
            switches: await this.switchesOf(workspaceId, attachments, switches),
            publicFacts: await this.publicFactsOf(workspaceId, attachments, facts),
        }
    }

    /**
     * The public facts of the agent's attached accounts (`connections.public_meta`, read through the connections' reader), each read once
     * per call (kept in `seen`): what each account's stream is read from. An account that cannot be read (logged), or an app with no
     * reader, has none: its stream is unknown, so it is its own and contests nothing.
     */
    private async publicFactsOf(
        workspaceId: string,
        attachments: ReadonlyArray<{ readonly connectionId: string }>,
        seen: Map<string, Readonly<Record<string, string>>>,
    ): Promise<ReadonlyMap<string, Readonly<Record<string, string>>>> {
        const reader = this.bindings
        if (reader === undefined) return seen
        await eachInOrder(
            [...new Set(attachments.map((attachment) => attachment.connectionId))].filter((id) => !seen.has(id)),
            async (connectionId) => {
                try {
                    seen.set(connectionId, (await reader.recordOf(workspaceId, connectionId))?.meta ?? {})
                } catch (cause: unknown) {
                    this.logger?.error(AgentGraphsLogEvent.NodeRightsUnreadable, cause, { workspaceId, connectionId })
                    seen.set(connectionId, {})
                }
            },
        )
        return seen
    }

    /** The founder's picks for one workflow; none in an app with no pick store or when the store cannot be read (logged). */
    private async picksOf(workspaceId: string, agentId: string, workflowId: string): Promise<TriggerReadinessFacts["picks"]> {
        try {
            return (await this.picks?.picksOf(workspaceId, agentId, workflowId)) ?? []
        } catch (cause: unknown) {
            this.logger?.error(AgentGraphsLogEvent.NodeRightsUnreadable, cause, { workspaceId, agentId, workflowId })
            return []
        }
    }

    /**
     * The trigger switches of the agent's attached accounts, read once per account per call (kept in `seen`). Undefined when no reader is
     * bound or one account cannot be read (logged): the trigger side then counts an attached account as switched on.
     */
    private async switchesOf(
        workspaceId: string,
        attachments: ReadonlyArray<{ readonly connectionId: string }>,
        seen: Map<string, ReadonlyArray<TriggerSwitchRow> | null>,
    ): Promise<ReadonlyMap<string, ReadonlyArray<TriggerSwitchRow>> | undefined> {
        const reader = this.switches
        if (reader === undefined) return undefined
        const accounts = [...new Set(attachments.map((attachment) => attachment.connectionId))]
        await eachInOrder(
            accounts.filter((connectionId) => !seen.has(connectionId)),
            async (connectionId) => {
                try {
                    seen.set(connectionId, await reader.listOf(workspaceId, connectionId))
                } catch (cause: unknown) {
                    this.logger?.error(AgentGraphsLogEvent.NodeRightsUnreadable, cause, { workspaceId, connectionId })
                    seen.set(connectionId, null)
                }
            },
        )
        const found = new Map<string, ReadonlyArray<TriggerSwitchRow>>()
        for (const connectionId of accounts) {
            const rows = seen.get(connectionId)
            if (rows === null || rows === undefined) return undefined
            found.set(connectionId, rows)
        }
        return found
    }

    /**
     * What readiness reads of the workspace for one workflow: the agent's attachments AS NODES NAME THEM (an OpenAPI account by the source
     * its pinned document serves, `crm`; one pinned to none is no provider of any node; of several accounts of a provider the CALL picks,
     * never readiness), and for each CRM operation the installed packages call the
     * accounts whose pinned document holds it callable (`servedOf`). Null in an app with no grant store, or when the store cannot be read
     * (logged): the graph then shows, exactly as before readiness.
     */
    private async readinessInputOf(
        workspaceId: string,
        agentId: string,
        workflowId: string | null,
    ): Promise<ReadinessInput | null> {
        const { access } = this
        if (access === undefined) return null
        try {
            const attached = await access.listOfAgent(workspaceId, agentId)
            const attachments = await accountsAsNodesName(workspaceId, attached, this.bindings)
            const served = await this.servedOf(workspaceId, attached)
            return {
                attachments,
                served,
                definedBlocking: (step: string) => this.blockingOf(step),
            }
        } catch (cause: unknown) {
            this.logger?.error(AgentGraphsLogEvent.NodeRightsUnreadable, cause, { workspaceId, agentId, workflowId })
            return null
        }
    }

    /**
     * The tools served only by some accounts, each with the agent's accounts that serve it: EVERY CRM operation the installed packages
     * call (owner chốt 2026-11-13, the compatibility check): served by the attached CRM connections whose pinned snapshot holds that
     * operation callable (`pinnedOpsOf`), each pin read once. An operation no attached pin holds blocks its node
     * (`tool_unavailable`, naming the operation). With no reader of connections no pin can be read: nothing serves these.
     */
    private async servedOf(
        workspaceId: string,
        attached: ReadonlyArray<{ readonly connectionId: string; readonly provider: string }>,
    ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
        const crmOps = OPENAPI_SOURCE_KEYS.flatMap((source) => installedDeclarationsOf(source).map((declared) => declared.tool))
        const served = new Map<string, Set<string>>(crmOps.map((tool) => [tool, new Set<string>()]))
        const reader = this.bindings
        if (served.size === 0 || reader === undefined) return served
        const pinned = [
            ...new Set(attached.filter((one) => one.provider === OPENAPI_PROVIDER).map((one) => one.connectionId)),
        ]
        await eachInOrder(pinned, async (connectionId) => {
            const record = await reader.recordOf(workspaceId, connectionId)
            for (const op of pinnedOpsOf(record?.meta ?? {})) served.get(op)?.add(connectionId)
        })
        return served
    }

    /** The `blocking` the installed step states (a template node or a `defineNode` node); undefined for none or a step not installed. */
    private blockingOf(step: string): boolean | undefined {
        return INSTALLED.stepOf(step)?.blocking
    }
}
