import { z } from "zod"
import type { RunStopAnswer, RunStopCustomerLine } from "./run-stop.shapes"
import type {
    FounderAnswerJson,
    RunStop,
    StopDecision,
    StopQuestion,
    StopRoute,
} from "./run-stop.contracts"

/** The node key that ends a thread (`THREAD_END` of the LangGraph port). */
export const STOP_END = "__end__"

/** The longest founder answer a decision carries. */
const ANSWER_MAX = 4000

/** The longest id or moment a decision carries. */
const SHORT_MAX = 200

const decisionSchema: z.ZodType<StopDecision> = z.union([
    z.object({
        kind: z.literal("answer"),
        text: z.string().trim().min(1).max(ANSWER_MAX),
        by: z.string().min(1).max(SHORT_MAX),
        at: z.string().min(1).max(SHORT_MAX),
    }),
    z.object({
        kind: z.enum(["retry", "take_over", "skip"]),
        by: z.string().min(1).max(SHORT_MAX),
        at: z.string().min(1).max(SHORT_MAX),
    }),
    z.object({ kind: z.literal("timeout"), at: z.string().min(1).max(SHORT_MAX) }),
])

/** The decision a resume carried, or null when it is none of the five kinds (a thread is never moved by a value it cannot read). */
export const stopDecisionOf = (value: unknown): StopDecision | null => {
    const parsed = decisionSchema.safeParse(value)
    return parsed.success ? parsed.data : null
}

/** A decision as the stop keeps it in its answers: the words of an `answer`, none for a button or a deadline. */
export const stopAnswerOf = (decision: StopDecision): RunStopAnswer => ({
    kind: decision.kind,
    text: decision.kind === "answer" ? decision.text : null,
    by: decision.kind === "timeout" ? "deadline" : decision.by,
    at: decision.at,
})

/**
 * Where an answer is already among the answers of a stop (same kind, words, person and time): the gate ran again after a crash with the
 * decision it was resumed with. -1 when the answer is new.
 */
export const answerIndexOf = (answers: ReadonlyArray<RunStopAnswer>, answer: RunStopAnswer): number =>
    answers.findIndex(
        (one) => one.kind === answer.kind && one.text === answer.text && one.by === answer.by && one.at === answer.at,
    )

/** The founder's words among the answers of a stop, oldest first, as a step's turn reads them. */
export const founderAnswersOf = (answers: ReadonlyArray<RunStopAnswer>): ReadonlyArray<FounderAnswerJson> =>
    answers.flatMap((answer) =>
        answer.kind === "answer" && answer.text !== null ? [{ text: answer.text, at: answer.at }] : [],
    )

/**
 * Where a decision sends the stopped thread. `answer`, `retry` and `timeout` run the stopped step again with every word the founder gave
 * this stop (an `answer` adds its own); the stop stays open until that run of the step completes (so the per-stop send guard holds
 * through a plain retry). `skip` ends the run and resolves the stop at once; `take_over` keeps the thread at the gate, the stop open, a
 * person holding the conversation. Mechanics only: the step decides what an answer means, the gate only carries it.
 */
export const stopRouteOf = (
    stop: Pick<RunStop, "stepKey" | "answers">,
    decision: StopDecision,
    gate: string,
): StopRoute => {
    const founderAnswers = founderAnswersOf([...stop.answers, stopAnswerOf(decision)])
    if (decision.kind === "skip") return { goto: STOP_END, founderAnswers, resolves: true }
    if (decision.kind === "take_over") return { goto: gate, founderAnswers, resolves: false }
    return { goto: stop.stepKey, founderAnswers, resolves: false }
}

/** What the gate hands `scope.stop` for a stop: plain JSON, read back by the door that answers it. */
export const stopQuestionOf = (stop: RunStop): StopQuestion => ({
    stopId: stop.id,
    runId: stop.runId,
    stepKey: stop.stepKey,
    kind: stop.kind,
    reason: stop.reason,
    question: stop.question,
})

/**
 * The line the customer was already told for this stop, in any conversation, or null: the newest of the stop's customer lines (the
 * step's own sends the ledger kept, and the engine's holding line) with no answer in words after it. One customer line per stop, ever
 * (design 8.3): when the step itself already told the customer, the engine adds no holding line of its own; the step's line is the one.
 * A button or a deadline is no new answer; the founder's words are (the stop may then tell the outcome).
 */
export const stopToldOf = (stop: Pick<RunStop, "customerLines" | "answers">): RunStopCustomerLine | null => {
    const last = stop.customerLines.toSorted((left, right) => left.at.localeCompare(right.at)).at(-1)
    if (last === undefined) return null
    return stop.answers.some((answer) => answer.kind === "answer" && answer.at > last.at) ? null : last
}
