import { Injectable } from "@nestjs/common"
import { LATEST_VERSION } from "@nivo-lite/agent-sdk/graph"
import type { WorkflowCallPin } from "@nivo-lite/agent-sdk/graph"
import type { EntityManager } from "typeorm"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowStoreService, WORKFLOW_LIMIT } from "./agent-workflow-store.service"
import type {
    OptionalWorkflowRoute,
    RoutableWorkflow,
    RouteWake,
    RunPinView,
    WorkflowRoute,
    WorkflowVersionRecord,
} from "./agent-workflows.contracts"
import { workflowRouteOf } from "./policies/workflow-route.policy"
import { takingTriggerOf } from "./policies/workflow-trigger.policy"
import { snapshotOf } from "./policies/workflow-view.policy"

/** The most versions looked through for the one a hand-off pinned. */
const VERSION_SCAN = 500

/** An active workflow with the version it runs. */
interface Running {
    /** The workflow's key, what a hand-off names. */
    readonly key: string
    readonly workflow: RoutableWorkflow
    readonly version: WorkflowVersionRecord
}

/** How the primary workflow of an agent, which has no key, is named among the running ones. */
const PRIMARY_NAME = "primary"

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
    ) {}

    /**
     * The workflow a wake goes to: the one an end hand-off pinned (by key and version), else the narrowest active workflow one of whose
     * triggers takes the wake (its source kind, channel, connection and conditions), with the snapshot the run
     * executes and the id its steps read their graph by: the agent graph version for the primary workflow (kept in step with it first),
     * the workflow version for any other. Null when no workflow takes the wake, so the agent's own graph answers it unpinned.
     */
    async route(workspaceId: string, agentId: string, wake: RouteWake): Promise<OptionalWorkflowRoute> {
        await this.adoption.adoptAgentGraph(workspaceId, agentId)
        return this.engine.scoped(workspaceId, async (tx) => {
            const running = await this.runningOf(tx, agentId)
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
            const running = await this.runningOf(tx, agentId)
            return {
                total: all.length,
                running: running.map((one) => one.key ?? PRIMARY_NAME),
                sources: [...new Set(running.flatMap((one) => one.workflow.sources))],
            }
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

    /** The active workflow one of whose triggers takes the wake, as `workflowRouteOf` picks among them (narrowest, primary, first). */
    private takerOf(running: ReadonlyArray<Running>, wake: RouteWake): Running | undefined {
        const takers = running.filter(
            (entry) => takingTriggerOf(snapshotOf(entry.version), wake.source, wake.scope) !== null,
        )
        const chosen = workflowRouteOf(
            takers.map((entry) => entry.workflow),
            wake.source,
        )
        return takers.find((entry) => entry.workflow.id === chosen)
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

    /** The agent's active workflows with the version each runs and the sources its graph wakes on. */
    private async runningOf(tx: ScopedTx, agentId: string): Promise<ReadonlyArray<Running>> {
        const found: Array<Running> = []
        const active = (await this.records.workflowsOf(tx, agentId, WORKFLOW_LIMIT)).filter(
            (workflow) => workflow.status === "active",
        )
        await eachInOrder(active, async (workflow) => {
            const version = await this.store.runningOf(tx, workflow)
            if (version === null) return
            found.push({
                key: workflow.key,
                workflow: { ...workflow, sources: [...snapshotOf(version).trigger.sources] },
                version,
            })
        })
        return found
    }
}
