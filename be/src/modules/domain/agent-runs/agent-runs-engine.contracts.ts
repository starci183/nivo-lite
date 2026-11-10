import type { AgentRunStatus, StepJson } from "./agent-runs.contracts"

/** One run as its readers read it: the flows, the thread runs, the stop door, the call guard and the cancel door. */
export interface RunView {
    /** The run. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The wake it answers. */
    readonly wakeId: string
    /** The trigger step of the graph. */
    readonly trigger: string
    /** The published version it runs on, or null. */
    readonly versionId: string | null
    /** Where it stands. */
    readonly status: AgentRunStatus
    /** The trigger, intact. */
    readonly context: StepJson
    /** Why it stopped, or null. */
    readonly errorCode: string | null
    /** Whether a person was told it stopped. */
    readonly spoken: boolean
}

/** The run, or null when there is none. */
export type OptionalRunView = RunView | null

/** The id of a run, or null when there is none. */
export type OptionalRunId = string | null

/** An owner or manager request to stop a run, as their door receives it. */
export interface OwnerCancelRequest {
    /** The Auth account asking. */
    readonly principalId: string
    /** The workspace the request is made in; the run must be one of its runs. */
    readonly workspaceId: string
    /** The run. */
    readonly runId: string
}

/**
 * The stops of the runs on LangGraph threads, as the cancel door reaches them: such a run is cancelled by its stop's skip, decided as
 * the person who asked. The stops register it when the app starts (they hold this door, never the other way round).
 */
export interface ThreadRunCancels {
    /** Skips the stop of the run as the person asking; answers as the cancel door does. */
    skipRun(request: OwnerCancelRequest): Promise<OwnerCancelAnswer>
}

/** What the store did with a cancel: the run stopped, was already cancelled, or had ended or been given to a person and is no longer cancellable. */
export interface RunCancelResult {
    /** `cancelled`, `already_cancelled`, `not_cancellable` or `not_found`. */
    readonly kind: "cancelled" | "already_cancelled" | "not_cancellable" | "not_found"
}

/** What the owner door answers to a cancel. */
export interface OwnerCancelAnswer {
    /** `cancelled`, `already_cancelled`, `not_cancellable`, `not_found` or `thread_run` (the run's stop is answered instead: skip). */
    readonly kind: RunCancelResult["kind"] | "thread_run"
    /** `effects_kept` when the run was cancelled: whatever its steps already sent or did stays as it is; null otherwise. */
    readonly note: "effects_kept" | null
}
