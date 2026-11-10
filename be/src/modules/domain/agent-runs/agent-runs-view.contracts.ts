import type { AgentStepStatus, StepJson } from "./agent-runs.contracts"
import type { RunRecord } from "./agent-runs-records.contracts"

/** One run of the list of an agent with how far its steps have come. */
export interface RunListEntry {
    /** The run. */
    readonly run: RunRecord
    /** The steps written so far. */
    readonly stepTotal: number
    /** The steps that are done or were undone. */
    readonly stepDone: number
    /** The steps that are no longer pending: running, done, failed or undone. */
    readonly stepBegun: number
    /** The steps that failed. */
    readonly stepFailed: number
    /** The work item the run's steps are about, or null. */
    readonly workItemId: string | null
}

/** One door call a step made. */
export interface RunStepCall {
    /** The tool called. */
    readonly tool: string
    /** Whether it succeeded. */
    readonly ok: boolean
    /** Why it failed, or null. */
    readonly failure: string | null
}

/** One step of a run with the moments, the calls and the error its page draws. */
export interface RunStepDetail {
    /** Unique within the run. */
    readonly stepKey: string
    /** The node of the published graph it is. */
    readonly nodeKey: string
    /** The handler kind. */
    readonly kind: string
    /** The place in the run, from one. */
    readonly ordinal: number
    /** Where it stands. */
    readonly status: AgentStepStatus
    /** The tries made. */
    readonly attempt: number
    /** The tries it gets. */
    readonly maxAttempts: number
    /** When it began, or null. */
    readonly startedAt: Date | null
    /** When it ended, or null. */
    readonly endedAt: Date | null
    /** How long it took, milliseconds, or null. */
    readonly durationMs: number | null
    /** Why it last failed, or null. */
    readonly errorCode: string | null
    /** The work item it waits on, or null. */
    readonly waitItemId: string | null
    /** The work item it is about, or null. */
    readonly workItemId: string | null
    /** What it was given. */
    readonly input: StepJson
    /** What it stored, or null. */
    readonly result: StepJson | null
    /** The door calls it made, in order. */
    readonly calls: ReadonlyArray<RunStepCall>
}

/** A run with its steps in order. */
export interface RunDetail {
    /** The run. */
    readonly run: RunRecord
    /** The steps in order. */
    readonly steps: ReadonlyArray<RunStepDetail>
}

/** The run with its steps, or null when the agent has no such run. */
export type OptionalRunDetail = RunDetail | null
