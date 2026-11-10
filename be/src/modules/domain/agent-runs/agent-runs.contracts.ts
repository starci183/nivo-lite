/** A JSON object a step keeps: bounded, masked, and enough to resume from the row alone. */
export type StepJson = Readonly<Record<string, unknown>>

/**
 * Where a run stands. `waiting` holds a durable wait; `dead` was given to a person with the trigger intact; `cancelled` was stopped by an
 * owner or manager, with what it had already sent left as it was.
 */
export type AgentRunStatus =
    "running" | "waiting" | "parked" | "done" | "failed" | "dead" | "compensating" | "compensated" | "cancelled"

/** Where a step stands. */
export type AgentStepStatus = "pending" | "running" | "done" | "failed" | "compensating" | "compensated"

/**
 * What a step does to the world. `read` changes nothing. `compensable` names the handler kind that undoes it. `pivot` cannot be undone
 * (a sent message, a bank action): once one is done, a later failure goes forward or to a person, never back.
 */
export type StepEffect =
    | { readonly kind: "read" }
    | { readonly kind: "compensable"; readonly compensation: string }
    | { readonly kind: "pivot" }

/** Opens the one run of a trigger. */
export interface RunOpen {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The wake it answers; one run per wake. */
    readonly wakeId: string
    /** The trigger step of the graph. */
    readonly trigger: string
    /** The published version it runs on, or null when the agent has no graph. */
    readonly versionId: string | null
    /** What a person needs when the run dies: the trigger, intact. */
    readonly context: StepJson
}

/** One step to write. */
export interface StepSpec {
    /** Unique within the run: the node key, plus what tells two calls of the node apart. With the run it is the idempotency key. */
    readonly stepKey: string
    /** The node of the published graph this step is, for the trace. */
    readonly nodeKey: string
    /** The handler kind that runs it. */
    readonly kind: string
    /** What it does to the world. */
    readonly effect: StepEffect
    /** All the step needs to run from the row alone. */
    readonly input: StepJson
    /** The tries it gets before it is dead; the kind's default when absent. */
    readonly maxAttempts?: number | undefined
    /** How long one try may run before the sweeper takes it, milliseconds; the kind's default when absent. */
    readonly deadlineMs?: number | undefined
}

/** One step as the thread engine reads it (thread-step, step memory, run notices, conversation holds). */
export interface StepView extends StepSpec {
    /** The run. */
    readonly runId: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The status. */
    readonly status: AgentStepStatus
    /** The try this is, from one. */
    readonly attempt: number
    /** The fence of this claim: a write under an older fence changes nothing. */
    readonly fence: number
    /** The stored result, or null. */
    readonly result: StepJson | null
    /** The results of the steps done before it, by step key. */
    readonly earlier: Readonly<Record<string, StepJson>>
}
