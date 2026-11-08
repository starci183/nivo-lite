import type { PresentationState } from "@starci/grammar/common" with { "resolution-mode": "import" }
import { formatValue, type CellContext } from "./cell-format"
import { runStateLook, type RunState } from "./run-state"
import type { RunStepView, RunView } from "./run-timeline-view"

/** One door call of a step as the timeline draws it. */
export interface RunCallRow {
    /** The key the call is drawn under, unique in its step. */
    readonly id: string
    /** The domain name of the tool. */
    readonly tool: string
    /** Whether the call succeeded. */
    readonly ok: boolean
    /** The result in a line; empty draws none. */
    readonly summary: string
}

/** One step of a run as the timeline draws it. */
export interface RunStepRow {
    /** The key the step is drawn under. */
    readonly id: string
    /** The name of the node the step ran. */
    readonly title: string
    /** The state of the step. */
    readonly state: RunState
    /** The key of the words of the state. */
    readonly stateKey: string
    /** The tone of the mark that carries the state. */
    readonly tone: "info" | "warning" | "danger" | "success"
    /** The presentation state of the entry. */
    readonly presentation: PresentationState
    /** Whether a person has to look at the step. */
    readonly isAttention: boolean
    /** Whether the run is at this step now. */
    readonly isCurrent: boolean
    /** The machine-readable start; null when the step has none. */
    readonly dateTime: string | null
    /** The start in the viewer's language; empty draws none. */
    readonly timeLabel: string
    /** What the step was given; empty draws none. */
    readonly input: string
    /** What the step produced; empty draws none. */
    readonly output: string
    /** How long the step took; empty draws none. */
    readonly duration: string
    /** The key of the outside effect; empty draws none. */
    readonly effectKey: string
    /** Why the step is parked or failed; empty draws none. */
    readonly reason: string
    /** The door calls of the step. */
    readonly calls: ReadonlyArray<RunCallRow>
    /** The app path of the approval a waiting step waits for; null draws no link. */
    readonly approvalPath: string | null
    /** Whether the step offers "run again": the first parked step of the run, and only that one. */
    readonly canResume: boolean
}

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

/** A duration in the units a person reads: milliseconds under a second, seconds under a minute, else minutes and seconds. */
export const durationText = (milliseconds: number, locale: string): string => {
    if (milliseconds < MS_PER_SECOND) return `${Math.round(milliseconds)} ms`
    const seconds = milliseconds / MS_PER_SECOND
    if (seconds < SECONDS_PER_MINUTE) {
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(seconds)} s`
    }
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE)
    return `${minutes} m ${String(Math.floor(seconds % SECONDS_PER_MINUTE)).padStart(2, "0")} s`
}

/** Whether a state is one a run is stopped or going in, not finished. */
const isLive = (state: RunState): boolean => state === "running" || state === "waiting" || state === "parked"

/** The steps of a run as the timeline draws them, in the order they ran. */
export const runStepsOf = (run: RunView, context: CellContext): ReadonlyArray<RunStepRow> => {
    const firstParked = run.steps.findIndex((step) => step.state === "parked")
    return run.steps.map((step, index): RunStepRow => {
        const look = runStateLook(step.state)
        return {
            id: step.id,
            title: step.label,
            state: step.state,
            stateKey: look.key,
            tone: look.tone,
            presentation: look.presentation,
            isAttention: look.isAttention,
            isCurrent: index === run.steps.length - 1 && isLive(step.state),
            dateTime: step.at ?? null,
            timeLabel: formatValue(step.at, "dateTime", context),
            input: step.inputSummary ?? "",
            output: step.outputSummary ?? "",
            duration:
                step.durationMs === undefined || step.durationMs === null
                    ? ""
                    : durationText(step.durationMs, context.locale),
            effectKey: step.effectKey ?? "",
            reason: step.reason ?? "",
            calls: (step.calls ?? []).map((call, order) => ({
                id: `${step.id}:${order}`,
                tool: call.tool,
                ok: call.ok,
                summary: call.summary ?? "",
            })),
            approvalPath: step.state === "waiting" ? (step.approvalPath ?? null) : null,
            canResume: index === firstParked || step.canResume === true,
        }
    })
}

/** The rows a skeleton draws. */
const PLACEHOLDER_COUNT = 3
const BLANK = "........"

/** Steps with the geometry of settled ones, for the skeleton of a timeline. */
export const RUN_PLACEHOLDER: RunView = {
    id: "placeholder",
    status: "done",
    steps: Array.from({ length: PLACEHOLDER_COUNT }, (_, index): RunStepView => ({
        id: `placeholder-${index}`,
        node: `placeholder-${index}`,
        label: BLANK,
        state: "done",
        inputSummary: BLANK,
        outputSummary: BLANK,
    })),
}

/** The run, or null when it has no step, which the block reads as an empty slot. */
export const runWithSteps = (run: RunView): RunView | null => (run.steps.length === 0 ? null : run)
