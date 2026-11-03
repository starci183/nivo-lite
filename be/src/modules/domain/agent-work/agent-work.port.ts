import type { AgentTurnUsage, AgentTurnView, AgentWakeSource, AgentWakeView } from "./agent-work.contracts"

/** A picture sent with a turn. */
export interface AgentTurnAttachment {
    /** The name of the file. */
    readonly fileName: string
    /** The type of the picture. */
    readonly mimeType: string
    /** The bytes, in base64. */
    readonly content: string
}

/** What a handler built for the executor: everything the model needs to know where and how to run, never the words themselves. */
export interface AgentTurnPlan {
    /** The module of the agent, for the usage meter and the gates. */
    readonly module: string
    /** The runtime's id of the agent; recorded on the turn before the model runs so tool calls find it. */
    readonly runtimeAgentId: string
    /** The runtime's session key of the turn. */
    readonly threadKey: string
    /** The whole authoritative context and the wake's text. */
    readonly message: string
    /** The pictures sent with it; absent sends none. */
    readonly attachments?: ReadonlyArray<AgentTurnAttachment>
    /** How long the model may take. */
    readonly timeoutMs: number
}

/** How a handler ends a wake: a turn that answers without a model, a settled proposal, or a hold-over line. */
export interface AgentHandlerEnding {
    /** The end of the wake. */
    readonly status: "done" | "skipped" | "held"
    /** Why, for a skip or a hold. */
    readonly reason: string | null
    /** What was done, stored on the turn. */
    readonly outcome: unknown
}

/** The executor of the turns, or undefined while none is bound. */
export type OptionalAgentTurnExecutor = AgentTurnExecutor | undefined

/** The handler of a source, or undefined while none registered. */
export type OptionalAgentWorkHandler = AgentWorkHandler | undefined

/** What `prepare` decided. */
export type AgentTurnPrep =
    | { readonly kind: "run"; readonly plan: AgentTurnPlan }
    | { readonly kind: "end"; readonly ending: AgentHandlerEnding }

/** What the executor answered. */
export type AgentTurnRun =
    | { readonly kind: "proposal"; readonly proposal: unknown; readonly usage: AgentTurnUsage | null }
    | { readonly kind: "blocked"; readonly reason: string }

/** Runs one turn on the runtime behind the gates of quota and breaker; it changes nothing outside the runtime and the usage meter. */
export interface AgentTurnExecutor {
    /** Runs the plan and answers what the model proposes, or why no turn could run. */
    run(turn: AgentTurnView, plan: AgentTurnPlan, signal: AbortSignal): Promise<AgentTurnRun>
}

/** The business of one kind of wake. Customer, tag and background each implement it; the drain holds the order and no business. */
export interface AgentWorkHandler {
    /** The sources this handler answers. */
    readonly sources: ReadonlyArray<AgentWakeSource>
    /** Builds the context of the turn, or ends the wake without a model call. */
    prepare(turn: AgentTurnView, signal: AbortSignal): Promise<AgentTurnPrep>
    /** Applies a proposal through the gates, idempotently per wake. */
    settle(turn: AgentTurnView, proposal: unknown, signal: AbortSignal): Promise<AgentHandlerEnding>
    /** Answers when no turn can run (quota, breaker, a runtime that is down, a wake too old, a switch that is off, a wake dead past its attempts); the wake may have no turn. */
    holdOver(wake: AgentWakeView, reason: string): Promise<AgentHandlerEnding>
}

/**
 * A graph that runs a wake itself, with no model turn: an agent whose published graph is composed of nodes. The drain asks it before
 * any handler; a wake it does not take goes to the handler of its source as before.
 */
export interface AgentWorkFlow {
    /** True when the agent's active graph runs this wake. */
    takes(turn: AgentTurnView): Promise<boolean>
    /** Runs the wake through the graph and answers how the wake ends. */
    run(turn: AgentTurnView, signal: AbortSignal): Promise<AgentHandlerEnding>
}

/** The flow, or undefined while no capability set one. */
export type OptionalAgentWorkFlow = AgentWorkFlow | undefined

/** Told when the runtime that was answering a wake goes down, so the durable run of the wake retries its step and reaches a person when the tries are spent. */
export interface WakeInterruptions {
    /** The runtime went down while the wake's turn ran; `code` says why. */
    interrupted(wakeId: string, code: string, signal: AbortSignal): Promise<void>
}

/** The handler of every source no handler answers by name: an inbound adapter with nothing of its own. It names the sources it takes. */
export interface AgentWorkFallback extends AgentWorkHandler {
    /** True for a source this fallback takes when no handler registered for it. */
    answers(source: AgentWakeSource): boolean
}

/** The one question the tag door asks the agents capability: the lists of who may tag whom. */
export interface AgentTagRights {
    /** Whether the agent may tag the other agent. */
    canTag(agentId: string, targetAgentId: string): Promise<boolean>
}
