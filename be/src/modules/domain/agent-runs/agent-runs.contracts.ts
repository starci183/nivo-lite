/** A JSON object a step keeps: bounded, masked, and enough to resume from the row alone. */
export type StepJson = Readonly<Record<string, unknown>>

/** Where a run stands. `waiting` holds a durable wait; `dead` was given to a person with the trigger intact. */
export type AgentRunStatus = "running" | "waiting" | "done" | "failed" | "dead" | "compensating" | "compensated"

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

/** One step as a handler reads it. There is no other state between nodes. */
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

/** What a handler answers. It never writes the step: the engine commits the answer and the next steps in one transaction. */
export type StepAnswer =
    | {
          /** The step is finished; `result` is stored and a replay returns it. */
          readonly kind: "done"
          /** The result. */
          readonly result: StepJson
          /** The steps that follow, written with it. */
          readonly next: ReadonlyArray<StepSpec>
      }
    | {
          /** The step waits for a person; the sweeper applies the graph's timeout at the deadline. */
          readonly kind: "wait"
          /** The work item it waits on. */
          readonly workItemId: string
          /** When the timeout action applies. */
          readonly deadlineAt: Date
      }
    | {
          /** This try failed and may be tried again, after the backoff. */
          readonly kind: "retry"
          /** Why. */
          readonly code: string
      }
    | {
          /** The step cannot succeed. */
          readonly kind: "failed"
          /** Why. */
          readonly code: string
      }

/** The business of one kind of step. It runs from the row alone, and running it twice has the effect of once. */
export interface AgentStepHandler {
    /** The kind. */
    readonly kind: string
    /** Runs one try. */
    run(step: StepView, signal: AbortSignal): Promise<StepAnswer>
    /** Undoes a done step, when this kind is the compensation another step named. */
    compensate?(step: StepView, signal: AbortSignal): Promise<void>
    /** Tells a person a run died at this step, with the trigger intact, and the customer the honest holding line. */
    deadLetter?(step: StepView, code: string): Promise<void>
}

/** What failure policy decided for a run. */
export type RunFailureRoute =
    | { readonly kind: "retry"; readonly afterMs: number }
    | { readonly kind: "compensate"; readonly stepKeys: ReadonlyArray<string> }
    | { readonly kind: "person"; readonly pivotKey: string | null }
