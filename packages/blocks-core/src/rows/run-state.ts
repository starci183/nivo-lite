import type { PresentationState } from "@starci/grammar/common" with { "resolution-mode": "import" }

/** The states a run, or one of its steps, is in once it has started. */
export const RUN_STATES = ["running", "waiting", "parked", "failed", "done"] as const

/** One state of a run or of one of its steps. */
export type RunState = (typeof RUN_STATES)[number]

/** How one run state is told: its words, the tone of its mark and the presentation state of its timeline entry. */
export interface RunStateLook {
    /** The key of the words of the state in the block copy. */
    readonly key: string
    /** The tone of the mark that carries the state. */
    readonly tone: "info" | "warning" | "danger" | "success"
    /** The presentation state of the timeline entry of a step in this state. */
    readonly presentation: PresentationState
    /** Whether a person has to look at a step in this state. */
    readonly isAttention: boolean
}

const LOOKS: Readonly<Record<RunState, RunStateLook>> = {
    running: { key: "runStateRunning", tone: "info", presentation: "informative", isAttention: false },
    waiting: { key: "runStateWaiting", tone: "warning", presentation: "pending", isAttention: true },
    parked: { key: "runStateParked", tone: "warning", presentation: "cautionary", isAttention: true },
    failed: { key: "runStateFailed", tone: "danger", presentation: "negative", isAttention: true },
    done: { key: "runStateDone", tone: "success", presentation: "affirmative", isAttention: false },
}

/** How a run state is told. */
export const runStateLook = (state: RunState): RunStateLook => LOOKS[state]
