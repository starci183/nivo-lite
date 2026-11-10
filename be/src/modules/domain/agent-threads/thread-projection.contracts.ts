import type { StepJson, StepSpec } from "@modules/domain/agent-runs"

/** The run a thread projects into: the run id is the thread id. */
export interface ThreadRunRefParams {
    /** The workspace. */
    readonly workspaceId: string
    /** The run, which is the thread. */
    readonly runId: string
}

/** One door call a step made, as its row keeps it. */
export interface ThreadStepCallParams {
    /** The tool called. */
    readonly tool: string
    /** Whether it succeeded. */
    readonly ok: boolean
    /** Why it failed, or null. */
    readonly failure: string | null
    /** The effect key it was sent under. */
    readonly effectKey: string
}

/**
 * What every fact about a step carries. `spec` is the step as the old engine would have written it (`graphNodeStepOf`), so a row the
 * start never wrote (a crash, a repair) is written whole from any fact. `ordinal` is the step's place in the thread's path, from one: the
 * steps the thread state holds before it, plus one, so a replay and a repair give the same place. `attempt` is the try, from one: a replay
 * of the same try passes the same number, a run of the step again after a stop (a founder's retry or answer, an approval) the next.
 */
export interface ThreadStepParams {
    /** The step. */
    readonly spec: StepSpec
    /** The place in the thread's path, from one. */
    readonly ordinal: number
    /** The try, from one. */
    readonly attempt: number
    /** When it happened. */
    readonly at: Date
}

/** A step ended: done, or failed and passed over (a side node, `blocking: false`) when `code` names why. */
export interface ThreadStepEndParams extends ThreadStepParams {
    /** What the step stored: `{ output, effects }`, with the AI core's `recovered` mark when it produced the output. */
    readonly result: StepJson
    /** The door calls it made, in order. */
    readonly calls: ReadonlyArray<ThreadStepCallParams>
    /** Null for a done step; the code of a failed step the run went past. */
    readonly code: string | null
    /** The work item it is about, or null. */
    readonly workItemId: string | null
}

/** A step stopped the thread (it went to the engine's gate): the run waits for a person. */
export interface ThreadStepStopParams extends ThreadStepParams {
    /** Why: the trouble code the stop records. */
    readonly code: string
    /** The facts of the trouble, or null. */
    readonly error: StepJson | null
    /** The door calls it made before it stopped, in order. */
    readonly calls: ReadonlyArray<ThreadStepCallParams>
    /** The work item a stop of kind approval waits on, or null; the step then shows as waiting, not failed. */
    readonly waitItemId: string | null
}

/** One fact about a step, as a repair replays them. */
export type ThreadStepFactParams =
    | ({ readonly kind: "started" } & ThreadStepParams)
    | ({ readonly kind: "ended" } & ThreadStepEndParams)
    | ({ readonly kind: "stopped" } & ThreadStepStopParams)

/** How a thread ended: it reached its end, a founder skipped the stopped step, or the engine could not go on. */
export type ThreadRunOutcome = "done" | "skipped" | "failed"

/** A thread ended. */
export interface ThreadRunEndParams {
    /** How. */
    readonly outcome: ThreadRunOutcome
    /** Why, for `skipped` and `failed`; null for `done`. */
    readonly code: string | null
    /** The member who skipped, or null. */
    readonly by: string | null
    /** When. */
    readonly at: Date
}

/** A thread resumed after a stop: the run runs again; the stopped step moves when it starts its next try. */
export interface ThreadRunResumeParams {
    /** When. */
    readonly at: Date
}

/**
 * What a thread's state says, for a repair: the step facts in the order the thread made them (the latest fact of each step is enough),
 * and the end when the thread ended. A stopped thread says so by its last fact.
 */
export interface ThreadReplayParams {
    /** The step facts, in order. */
    readonly steps: ReadonlyArray<ThreadStepFactParams>
    /** The end, or null while the thread runs or is stopped. */
    readonly end: ThreadRunEndParams | null
}

/**
 * What a projection write did: `written` changed the rows, `kept` found them already saying it (a replay) or saying something later (a
 * late fact), `missing` found no run, `refused` was refused by the engine (the rows only show, so a refusal never stops a thread).
 */
export type ThreadProjectionOutcome = "written" | "kept" | "missing" | "refused"
