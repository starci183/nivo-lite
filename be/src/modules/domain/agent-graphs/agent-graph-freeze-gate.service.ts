import { Injectable, Optional } from "@nestjs/common"
import type { StepJson } from "@modules/domain/agent-runs"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { InjectFlowTriggerMessages } from "./agent-graphs.decorators"
import type { FlowTriggerMessage, FlowTriggerMessages } from "./agent-graphs.port"
import type { FlowTriggerScope } from "./agent-graphs.contracts"
import { GRAPH_NODE_STEP_KIND } from "./policies/graph-flow.policy"

/** A run of a node graph that stopped for good: what the freeze of its customer is told. */
export interface FlowStop {
    /** The workspace. */
    readonly workspaceId: string
    /** The run. */
    readonly runId: string
    /** Why it stopped. */
    readonly code: string
    /** The step it stopped on, when the caller knows it. */
    readonly stepKey: string | null
    /** The trigger scope of the run, when the caller holds it. */
    readonly trigger: StepJson | null
}

/**
 * The freeze of a customer as the graph flows see it. A capability that keeps the freezes registers it when its module starts, so the
 * flows never hold that capability in a constructor (it reaches the run engine and the work engine, which reach the flows).
 */
export interface FlowFreezePort {
    /** True when the wake must start no run: its customer is frozen, and the wake was recorded for them as a pending event. */
    hold(turn: AgentTurnView, trigger: FlowTriggerScope): Promise<boolean>
    /** True when the stopped run froze its customer (now or before): the owner's one item is the freeze's, so no per-run item is raised. */
    stopped(stop: FlowStop): Promise<boolean>
    /** True when the workflow the trigger names is frozen for its customer; nothing is recorded. */
    frozen(workspaceId: string, trigger: FlowTriggerScope): Promise<boolean>
    /** What waits for the founder for the customer of the trigger, whatever the workflow. */
    waitingOf(workspaceId: string, trigger: FlowTriggerScope): Promise<ReadonlyArray<FlowWaiting>>
}

/** One thing of a customer that waits for the founder: the step its workflow stopped on, and since when. */
export interface FlowWaiting {
    /** The step the workflow stopped on, in the owner's words. */
    readonly step: string
    /** When it stopped, ISO text. */
    readonly since: string
}

/** The customer lines a conversation holds, as the flows read them; none while the app binds no store of the lines. */
export type FlowLines = ReadonlyArray<FlowTriggerMessage>

@Injectable()
/**
 * The one door between the graph flows and the freezes of customers. Inward: the start of a wake's run asks `hold` before any step is
 * written, and a run that stopped for good tells `stopped` before the owner is asked; with nothing registered (an app that keeps no
 * freezes) it holds and freezes nothing, so the flows behave exactly as before. Outward: what the freezes read of the flows, the kind of
 * a node step and the lines of a conversation, so the freezes need no other entry of the flows.
 */
export class AgentGraphFreezeGateService {
    private port: FlowFreezePort | undefined = undefined

    constructor(
        @Optional() @InjectFlowTriggerMessages() private readonly messages: FlowTriggerMessages | null = null,
    ) {}

    /** Registers the freezes of the app: one capability keeps them, so the last registration is the one asked. */
    set(port: FlowFreezePort): void {
        this.port = port
    }

    /** True when the wake must start no run because its customer is frozen; false with no freezes registered. */
    hold(turn: AgentTurnView, trigger: FlowTriggerScope): Promise<boolean> {
        return this.port === undefined ? Promise.resolve(false) : this.port.hold(turn, trigger)
    }

    /** True when the stopped run froze its customer; false with no freezes registered. */
    stopped(stop: FlowStop): Promise<boolean> {
        return this.port === undefined ? Promise.resolve(false) : this.port.stopped(stop)
    }

    /** True when the workflow the trigger names is frozen for its customer; false with no freezes registered. */
    frozen(workspaceId: string, trigger: FlowTriggerScope): Promise<boolean> {
        return this.port === undefined ? Promise.resolve(false) : this.port.frozen(workspaceId, trigger)
    }

    /** What waits for the founder for the customer of the trigger; nothing with no freezes registered. */
    waitingOf(workspaceId: string, trigger: FlowTriggerScope): Promise<ReadonlyArray<FlowWaiting>> {
        return this.port === undefined ? Promise.resolve([]) : this.port.waitingOf(workspaceId, trigger)
    }

    /** Whether a step of a run is a node step of a graph: only a graph run freezes its customer. */
    isNodeStep(kind: string): boolean {
        return kind === GRAPH_NODE_STEP_KIND
    }

    /** The customer's lines among the ids (and those not answered yet), in the order they were said; none with no store bound. */
    linesOf(workspaceId: string, conversationId: string, messageIds: ReadonlyArray<string>): Promise<FlowLines> {
        return this.messages === null
            ? Promise.resolve([])
            : this.messages.messagesOf(workspaceId, conversationId, messageIds)
    }
}
