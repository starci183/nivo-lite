/** The state of one run. */
export type RunStatus = "queued" | "running" | "done" | "skipped" | "waiting_approval" | "failed"

/** What a trigger carried: a run is executed (and retried) from it. */
export interface RunPayload {
    /** Any value the trigger carried, by name. */
    readonly [name: string]: unknown
}

/** An instant, or none. */
export type OptionalDate = Date | undefined

/** One step of a run as the history shows it. */
export interface RunStep {
    /** What happened, in plain words. */
    readonly label: string
    /** How the step ended. */
    readonly status: "done" | "skipped" | "waiting" | "failed"
    /** The detail line under the label. */
    readonly detail?: string | undefined
    /** The decision this step waits for or sent through. */
    readonly workItemId?: string
    /** The message that was, or will be, sent. */
    readonly message?: string
}

/** What an executor answers after one trigger. */
export interface RunResult {
    /** How the run ended. */
    readonly status: RunStatus
    /** The steps, in order. */
    readonly steps: ReadonlyArray<RunStep>
    /** Why it did this, in one line. */
    readonly evidence?: string | null | undefined
}

/** The raw run row. */
export interface RunRow {
    /** The run id. */
    readonly id: string
    /** The pipeline. */
    readonly pipeline_id: string
    /** What triggered it. */
    readonly trigger_ref: string
    /** How it stands. */
    readonly status: RunStatus
    /** The steps; null before the first one is recorded. */
    readonly steps: ReadonlyArray<RunStep> | null
    /** Why it did this. */
    readonly evidence: string | null
    /** The error. */
    readonly error: string | null
    /** When it started. */
    readonly created_at: string
    /** When it ended. */
    readonly finished_at: string | null
}

/** What starts a run record. */
export interface BeginRun {
    /** The pipeline. */
    readonly pipelineId: string
    /** The workspace. */
    readonly workspaceId: string
    /** Unique per pipeline: the same key never runs twice. */
    readonly dedupe: string
    /** What the run is about. */
    readonly triggerRef: string
    /** What the trigger carried. */
    readonly payload: RunPayload
    /** When the run is due; a time in the future stores it queued for a later tick. */
    readonly runAt: OptionalDate
}

/** A run claimed for execution. */
export interface ClaimedRun {
    /** The run id. */
    readonly id: string
    /** How many attempts were started, this one included. */
    readonly attempts: number
    /** What the trigger carried. */
    readonly payload: RunPayload
}

/** A run, or none. */
export type ClaimedRunOrNone = ClaimedRun | null

/** What an executor does for one claimed run. */
export type RunExecution = () => Promise<RunResult>

/** A run that waits for the owner's decision on one work item. */
export interface WaitingRun {
    /** The run id. */
    readonly id: string
    /** Its pipeline. */
    readonly pipeline_id: string
    /** Its steps. */
    readonly steps: ReadonlyArray<RunStep>
}

/** How a waiting run ended once the owner decided. */
export interface RunSettlement {
    /** The run. */
    readonly runId: string
    /** The final status. */
    readonly status: RunStatus
    /** The steps, with the waiting step replaced by the answer. */
    readonly steps: ReadonlyArray<RunStep>
    /** Why. */
    readonly evidence: string
}

/** What the history of a workspace is asked for. */
export interface RunsQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** Only this template, or every template when none. */
    readonly templateKey: string | null
    /** The most runs to answer. */
    readonly limit: number
}

/** The latest finished run of a pipeline for one reference. */
export interface LatestRunQuery {
    /** The pipeline. */
    readonly pipelineId: string
    /** The reference the run is about. */
    readonly reference: string
    /** Only runs since this instant, ISO 8601. */
    readonly since: string
}

/** One row of the history of a pipeline. */
export interface PriorRunRow {
    /** What the run was about. */
    readonly trigger_ref: string
    /** How it ended. */
    readonly status: string
    /** When it started. */
    readonly created_at: string
    /** Its dedupe key. */
    readonly dedupe_key: string
}
