import { z } from "zod"
import { RUN_STEPS_MAX } from "./graph-view"
import { RUN_STATES } from "./run-state"
import type { RunState } from "./run-state"

/** The most door calls one step lists. */
export const RUN_CALLS_MAX = 20

const ID_MAX = 120
const LABEL_MAX = 200
const SUMMARY_MAX = 500
const PATH_MAX = 300

/** One door call a step made and what came back. */
export interface RunCallView {
    /** The domain name of the tool the step called. */
    readonly tool: string
    /** Whether the call succeeded. */
    readonly ok: boolean
    /** The result in a line: the answer, or why it failed. */
    readonly summary?: string | null | undefined
}

/** One step of a run as a read yields it. */
export interface RunStepView {
    /** The key of the step, unique in its run. */
    readonly id: string
    /** The id of the node of the graph the step ran. */
    readonly node: string
    /** The name of that node. */
    readonly label: string
    /** The state of the step. */
    readonly state: RunState
    /** When the step started, as an ISO date-time. */
    readonly at?: string | null | undefined
    /** What the step was given, in a line. */
    readonly inputSummary?: string | null | undefined
    /** What the step produced, in a line. */
    readonly outputSummary?: string | null | undefined
    /** How long the step took, in milliseconds. */
    readonly durationMs?: number | null | undefined
    /** The door calls the step made. */
    readonly calls?: ReadonlyArray<RunCallView> | null | undefined
    /** The key under which the step's outside effect was recorded, so it happens once. */
    readonly effectKey?: string | null | undefined
    /** Why the step is parked or failed. */
    readonly reason?: string | null | undefined
    /** The app path of the approval a waiting step waits for. */
    readonly approvalPath?: string | null | undefined
    /** Whether the run stopped on this step and the engine may run it again from here, though the step is not drawn parked. */
    readonly canResume?: boolean | undefined
}

/** One run as a read yields it: its id and state, and its steps in the order they ran. */
export interface RunView {
    /** The id of the run, which the resume action takes. */
    readonly id: string
    /** The state of the run as a whole. */
    readonly status: RunState
    /** The steps, in the order they ran. */
    readonly steps: ReadonlyArray<RunStepView>
}

const call: z.ZodType<RunCallView> = z.looseObject({
    tool: z.string().min(1).max(ID_MAX),
    ok: z.boolean(),
    summary: z.string().max(SUMMARY_MAX).nullish(),
})

const step: z.ZodType<RunStepView> = z.looseObject({
    id: z.string().min(1).max(ID_MAX),
    node: z.string().min(1).max(ID_MAX),
    label: z.string().max(LABEL_MAX),
    state: z.enum(RUN_STATES),
    at: z.string().max(ID_MAX).nullish(),
    inputSummary: z.string().max(SUMMARY_MAX).nullish(),
    outputSummary: z.string().max(SUMMARY_MAX).nullish(),
    durationMs: z.number().int().min(0).nullish(),
    calls: z.array(call).max(RUN_CALLS_MAX).nullish(),
    effectKey: z.string().max(ID_MAX).nullish(),
    reason: z.string().max(SUMMARY_MAX).nullish(),
    approvalPath: z.string().max(PATH_MAX).nullish(),
    canResume: z.boolean().optional(),
})

/** The shape of the run read: the steps of one run with their calls, effect keys and reasons. */
export const runView: z.ZodType<RunView> = z.looseObject({
    id: z.string().min(1).max(ID_MAX),
    status: z.enum(RUN_STATES),
    steps: z.array(step).max(RUN_STEPS_MAX),
})
