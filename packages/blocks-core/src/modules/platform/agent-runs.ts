import type { RunState } from "../../rows/run-state"
import type { RunCallView, RunStepView, RunView } from "../../rows/run-timeline-view"
import type { CoreRun, CoreRunCount, CoreRunStep } from "./platform.types"

/** The filters of the runs list: what a person tells apart, each standing for one or more statuses of the engine. */
export const RUN_FILTERS = ["running", "parked", "done", "failed"] as const

/** One filter of the runs list. */
export type RunFilter = (typeof RUN_FILTERS)[number]

/** The value of the status param that narrows nothing. */
export const ALL_RUNS = "all"

/** The statuses of the engine each filter stands for. */
const FILTER_STATUSES: Readonly<Record<RunFilter, ReadonlyArray<string>>> = {
    running: ["running", "waiting", "compensating"],
    parked: ["parked"],
    done: ["done", "compensated"],
    failed: ["failed", "dead"],
}

/** The engine statuses of a filter, to narrow a query to it. */
export const statusesOf = (filter: RunFilter): ReadonlyArray<string> => FILTER_STATUSES[filter]

/** The filter a status of the engine belongs to; a status this build does not know reads as running, so the run is still listed. */
export const filterOf = (status: unknown): RunFilter =>
    RUN_FILTERS.find((filter) => typeof status === "string" && FILTER_STATUSES[filter].includes(status)) ?? "running"

/** The state a run is drawn in on its timeline, by the engine status. */
export const runStateOf = (status: unknown): RunState => {
    if (status === "waiting") return "waiting"
    if (status === "parked") return "parked"
    const filter = filterOf(status)
    return filter === "failed" || filter === "done" ? filter : "running"
}

/** One run as the list draws it. */
export interface AgentRunRow {
    /** The run id, which `platform.resume-run` takes. */
    readonly id: string
    /** The filter the run belongs to. */
    readonly status: RunFilter
    /** What woke the agent, as the engine keeps it. */
    readonly trigger: string
    /** When the run started, in the viewer's language and zone. */
    readonly when: string
    /** How long the run took (or has run so far), as a clock; empty when the run has no start. */
    readonly duration: string
}

/** What the viewer's words of times need. */
export interface RunLocale {
    /** The language tag. */
    readonly locale: string
    /** The time zone the start is drawn in. */
    readonly timeZone: string
    /** The instant the read runs at: the end of a run that has not ended. */
    readonly now: Date
}

const SECOND = 1000
const MINUTE = 60
const HOUR = 3600

/** A length of time as a clock: `0:42`, `3:05`, `1:02:03`. */
export const clockOf = (ms: number): string => {
    const total = Math.max(0, Math.round(ms / SECOND))
    const hours = Math.floor(total / HOUR)
    const minutes = Math.floor((total % HOUR) / MINUTE)
    const seconds = String(total % MINUTE).padStart(2, "0")
    if (hours === 0) return `${String(minutes)}:${seconds}`
    return `${String(hours)}:${String(minutes).padStart(2, "0")}:${seconds}`
}

/** The instant of an ISO text; null when the value is no date. */
const instantOf = (value: unknown): Date | null => {
    if (typeof value !== "string") return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

/** The start as the viewer reads it: date and time, short. */
export const whenOf = (value: unknown, where: RunLocale): string => {
    const date = instantOf(value)
    if (date === null) return ""
    return new Intl.DateTimeFormat(where.locale, {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: where.timeZone,
    }).format(date)
}

/** How long a run took: from its start to its end, or to now while it has not ended. */
export const durationOf = (startedAt: unknown, endedAt: unknown, now: Date): string => {
    const start = instantOf(startedAt)
    if (start === null) return ""
    const end = instantOf(endedAt) ?? now
    return clockOf(end.getTime() - start.getTime())
}

/** The row of one run of the list. */
export const runRowOf = (run: CoreRun, where: RunLocale): AgentRunRow => ({
    id: run.id,
    status: filterOf(run.status),
    trigger: run.trigger,
    when: whenOf(run.startedAt, where),
    duration: durationOf(run.startedAt, run.endedAt, where.now),
})

/** One page of the runs of an installation: the rows and the cursor of the next page. */
export interface AgentRunsPage {
    /** The runs, newest first. */
    readonly rows: ReadonlyArray<AgentRunRow>
    /** The cursor of the next page; null on the last. */
    readonly cursor: string | null
}

/** The runs of an agent per filter and in all, as the filter tabs read them. */
export interface AgentRunCounts {
    /** The number of runs under each filter, every filter present. */
    readonly counts: Readonly<Record<RunFilter, number>>
    /** The sum of the counts. */
    readonly total: number
}

/** The counts of the runs by engine status: several statuses of one filter add up. */
export const countsOf = (groups: ReadonlyArray<CoreRunCount>): AgentRunCounts => {
    const counts: Record<RunFilter, number> = { running: 0, parked: 0, done: 0, failed: 0 }
    for (const group of groups) counts[filterOf(group.status)] += group.count
    return { counts, total: RUN_FILTERS.reduce((sum, filter) => sum + counts[filter], 0) }
}

/** The longest line a step tells of what it was given or produced. */
const SUMMARY_LENGTH = 160

/** What a JSON object holds, in a line: `key: value` of each plain field, cut at a length. Empty for anything that is no object. */
export const summaryOf = (value: unknown): string => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return ""
    const parts = Object.entries(value)
        .filter(
            (entry): entry is [string, string | number | boolean] =>
                typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean",
        )
        .map(([key, held]) => `${key}: ${String(held)}`)
    const line = parts.join(", ")
    return line.length > SUMMARY_LENGTH ? `${line.slice(0, SUMMARY_LENGTH - 1)}\u2026` : line
}

/** The door calls a step recorded, as the timeline lists them; none where the step recorded none. */
export const callsOf = (value: unknown): ReadonlyArray<RunCallView> => {
    const calls = typeof value === "object" && value !== null && "calls" in value ? value.calls : null
    if (!Array.isArray(calls)) return []
    return calls.flatMap((call: unknown): ReadonlyArray<RunCallView> => {
        if (typeof call !== "object" || call === null) return []
        const tool = "tool" in call ? call.tool : null
        const ok = "ok" in call ? call.ok : null
        if (typeof tool !== "string" || typeof ok !== "boolean") return []
        const failure = "failure" in call && typeof call.failure === "string" ? call.failure : null
        return [{ tool, ok, summary: failure }]
    })
}

/** Whether a step reached its end (finished, or undone). */
const isFinished = (status: unknown): boolean => status === "done" || status === "compensated"

/** The engine statuses of a run that stopped on a failed step and may be run again from it, as the engine's resume takes them. */
const RESUMABLE_STATUSES: ReadonlySet<string> = new Set(["failed", "dead"])

/** Whether a step was undone or is being undone: a run with such a step has nothing left to run again from. */
const isUndone = (status: unknown): boolean => status === "compensated" || status === "compensating"

/** The state of a step that is not the one a parked run stopped at. */
const stepStateOf = (status: unknown, runIsWaiting: boolean, waitsOnItem: boolean): RunState => {
    if (status === "failed") return "failed"
    if (status === "done" || status === "compensated") return "done"
    return runIsWaiting && waitsOnItem ? "waiting" : "running"
}

/**
 * The timeline of one run: its steps in order. In a parked run the first step that did not finish is the one it stopped at: it is
 * drawn parked, with the reason the engine parked it, and is the one that offers to run again. A failed or dead run (one that stopped after
 * its tries or was given to a person) offers to run again from its first failed step, drawn failed, unless one of its steps was undone.
 */
export const runViewOf = (run: CoreRun, steps: ReadonlyArray<CoreRunStep>): RunView => {
    const { status, parkReason } = run
    const parkedAt = status === "parked" ? steps.findIndex((step) => !isFinished(step.status)) : -1
    const resumableAt =
        RESUMABLE_STATUSES.has(status) && !steps.some((step) => isUndone(step.status))
            ? steps.findIndex((step) => step.status === "failed")
            : -1
    return {
        id: run.id,
        status: runStateOf(status),
        steps: steps.map((step, index): RunStepView => {
            const isParked = index === parkedAt
            const reason = isParked && parkReason !== null ? parkReason : step.errorCode
            return {
                id: step.stepKey,
                node: step.nodeKey,
                label: step.nodeKey,
                state: isParked ? "parked" : stepStateOf(step.status, status === "waiting", step.waitItemId !== null),
                at: step.startedAt,
                inputSummary: summaryOf(step.input),
                outputSummary: summaryOf(step.result),
                durationMs: step.durationMs,
                calls: callsOf(step.doorCalls),
                effectKey: step.effectKey,
                reason,
                approvalPath: null,
                ...(index === resumableAt ? { canResume: true } : {}),
            }
        }),
    }
}
