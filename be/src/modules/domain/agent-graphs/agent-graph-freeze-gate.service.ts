import { Injectable } from "@nestjs/common"
import type { AgentTurnView } from "@modules/domain/agent-work"
import type { FlowTriggerScope } from "./agent-graphs.contracts"
import { GRAPH_NODE_STEP_KIND } from "./policies/graph-flow.policy"

/**
 * The freeze of a customer as the graph flows see it. A capability that keeps the freezes registers it when its module starts, so the
 * flows never hold that capability in a constructor (it reaches the run engine and the work engine, which reach the flows).
 */
export interface FlowFreezePort {
    /** True when the wake must start no run: its customer is frozen, and the wake was recorded for them as a pending event. */
    hold(turn: AgentTurnView, trigger: FlowTriggerScope): Promise<boolean>
    /** True when the workflow the trigger names is frozen for its customer; nothing is recorded. */
    frozen(workspaceId: string, trigger: FlowTriggerScope): Promise<boolean>
    /** What waits for the founder for the customer of the trigger, whatever the workflow. */
    waitingOf(workspaceId: string, trigger: FlowTriggerScope): Promise<ReadonlyArray<FlowWaiting>>
    /** The events held for a run while it waited at a stop that no step of it took yet, oldest first (the run's queue, ROAD-API 4). */
    untakenOfRun(workspaceId: string, runId: string): Promise<ReadonlyArray<FlowHeldEvent>>
    /** Records that a step visit of the run (`<run>:<step>:<visit>`) took these held events: they are never replayed as runs of their own. */
    markTaken(workspaceId: string, runId: string, wakeIds: ReadonlyArray<string>, visit: string): Promise<void>
}

/** One event the freeze gate held for a run: the wake it came on, and the trigger scope it was held with (when one was kept). */
export interface FlowHeldEvent {
    readonly wakeId: string
    readonly trigger?: Readonly<Record<string, unknown>> | undefined
}

/** One thing of a customer that waits for the founder: the step its workflow stopped on, and since when. */
export interface FlowWaiting {
    /** The step the workflow stopped on, in the owner's words. */
    readonly step: string
    /** When it stopped, ISO text. */
    readonly since: string
}

@Injectable()
/**
 * The one door between the graph flows and the freezes of customers. Inward: the start of a wake's run asks `hold` before the run opens
 * (a customer with an open stop holds new wakes of the same workflow); with nothing registered (an app that keeps no freezes) it holds
 * nothing, so the flows behave exactly as before. Outward: what the freezes read of the flows (the kind of
 * a node step), so the freezes need no other entry of the flows.
 */
export class AgentGraphFreezeGateService {
    private port: FlowFreezePort | undefined = undefined

    /** Registers the freezes of the app: one capability keeps them, so the last registration is the one asked. */
    set(port: FlowFreezePort): void {
        this.port = port
    }

    /** True when the wake must start no run because its customer is frozen; false with no freezes registered. */
    hold(turn: AgentTurnView, trigger: FlowTriggerScope): Promise<boolean> {
        return this.port === undefined ? Promise.resolve(false) : this.port.hold(turn, trigger)
    }

    /** True when the workflow the trigger names is frozen for its customer; false with no freezes registered. */
    frozen(workspaceId: string, trigger: FlowTriggerScope): Promise<boolean> {
        return this.port === undefined ? Promise.resolve(false) : this.port.frozen(workspaceId, trigger)
    }

    /** What waits for the founder for the customer of the trigger; nothing with no freezes registered. */
    waitingOf(workspaceId: string, trigger: FlowTriggerScope): Promise<ReadonlyArray<FlowWaiting>> {
        return this.port === undefined ? Promise.resolve([]) : this.port.waitingOf(workspaceId, trigger)
    }

    /** The held events of a run no step took yet; none with no freezes registered. */
    untakenOfRun(workspaceId: string, runId: string): Promise<ReadonlyArray<FlowHeldEvent>> {
        return this.port === undefined ? Promise.resolve([]) : this.port.untakenOfRun(workspaceId, runId)
    }

    /** Records held events of a run as taken by a step visit; nothing with no freezes registered. */
    markTaken(workspaceId: string, runId: string, wakeIds: ReadonlyArray<string>, visit: string): Promise<void> {
        return this.port === undefined ? Promise.resolve() : this.port.markTaken(workspaceId, runId, wakeIds, visit)
    }

    /** Whether a step of a run is a node step of a graph: only a graph run freezes its customer. */
    isNodeStep(kind: string): boolean {
        return kind === GRAPH_NODE_STEP_KIND
    }
}
