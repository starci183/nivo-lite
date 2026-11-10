import type { BadgeTone } from "@starci/grammar/common"
import type { RunContext, RunSource, RunStatus, RunStepStatus } from "./agentRuns.types"

const SECOND = 1000
const MINUTE = 60
const HOUR = 3600

/** The tones of the badge of each status of a run. */
const STATUS_TONES: Readonly<Record<RunStatus, BadgeTone>> = {
    queued: "neutral",
    scheduled: "neutral",
    running: "accent",
    waiting: "warning",
    done: "success",
    failed: "danger",
    cancelled: "neutral",
}

/** The tones of the badge of each status of a step. */
const STEP_TONES: Readonly<Record<RunStepStatus, BadgeTone>> = {
    pending: "neutral",
    running: "accent",
    waiting: "warning",
    done: "success",
    failed: "danger",
    undone: "neutral",
}

/** The tone of the badge of a run status. */
export const statusToneOf = (status: RunStatus): BadgeTone => STATUS_TONES[status]

/** The tone of the badge of a step status. */
export const stepToneOf = (status: RunStepStatus): BadgeTone => STEP_TONES[status]

/** The statuses the wire may carry, narrowed; a status this build does not know reads as running so the run is still listed. */
export const runStatusOf = (status: string): RunStatus => {
    const known: ReadonlyArray<RunStatus> = ["queued", "scheduled", "running", "waiting", "done", "failed", "cancelled"]
    return known.find((entry) => entry === status) ?? "running"
}

/** The statuses of a step the wire may carry, narrowed; an unknown one reads as pending. */
export const stepStatusOf = (status: string): RunStepStatus => {
    const known: ReadonlyArray<RunStepStatus> = ["pending", "running", "waiting", "done", "failed", "undone"]
    return known.find((entry) => entry === status) ?? "pending"
}

/** What woke a run, narrowed; an unknown source reads as an event. */
export const runSourceOf = (source: string): RunSource => {
    const known: ReadonlyArray<RunSource> = ["customer", "schedule", "event", "agent", "person"]
    return known.find((entry) => entry === source) ?? "event"
}

/** A length of time in the largest unit that fits: seconds, minutes or hours. */
export const durationOf = (ms: number | null, context: RunContext): string => {
    if (ms === null) return ""
    const seconds = Math.max(0, Math.round(ms / SECOND))
    if (seconds < MINUTE) return context.t("durSeconds", { count: Math.max(seconds, 1) })
    if (seconds < HOUR) return context.t("durMinutes", { count: Math.round(seconds / MINUTE) })
    return context.t("durHours", { count: Math.round(seconds / HOUR) })
}

/** The short name of a run: the first six characters of its id. */
export const shortIdOf = (runId: string): string => runId.slice(0, 6)
