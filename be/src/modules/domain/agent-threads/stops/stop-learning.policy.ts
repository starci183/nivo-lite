import { namesInternalIds, type LessonCandidateThen } from "@modules/domain/brain-lessons"
import { parseJsonText } from "@modules/platform/primitives"
import type { RunStop } from "./run-stop.contracts"

/** One free-text answer of a person to an AI report stop, with what the step then did. */
export interface StopAnswered {
    /** The person's words. */
    readonly text: string
    /** The member who answered. */
    readonly by: string
    /** When, ISO. */
    readonly at: string
    /** What the step did after it. */
    readonly thenDid: LessonCandidateThen
}

/**
 * The free-text answers of a stop worth learning from, with what the step then did: only stops the AI reported (an AI error, an approval
 * or an engine stop teaches nothing about the shop's rules). An answer followed by another decision made the step stop again (or was
 * overtaken by a skip); the last answer of a resolved stop let the step complete; the last answer of a stop still open whose decision is
 * that answer is still being applied (not yet known: left for a later settle). Words that carry an identifier of the engine (a tool id, a
 * uuid, a snake_case key: the engine's own text, such as the refusal an approval stop folded into this stop keeps) are no person's words.
 */
export const answeredOf = (stop: RunStop): ReadonlyArray<StopAnswered> => {
    if (stop.kind !== "ai_report") return []
    return stop.answers.flatMap((answer, index): Array<StopAnswered> => {
        const text = answer.text?.trim() ?? ""
        if (answer.kind !== "answer" || text === "" || namesInternalIds(text)) return []
        const later = stop.answers.slice(index + 1)
        const thenDid = thenOf(stop, later.map((one) => one.kind))
        return thenDid === "open" ? [] : [{ text, by: answer.by, at: answer.at, thenDid }]
    })
}

/** What the step did after an answer, from the decisions that came after it and the stop as it stands. */
const thenOf = (stop: RunStop, later: ReadonlyArray<string>): LessonCandidateThen => {
    if (later.includes("skip")) return "skipped"
    if (later.length > 0) return "stopped_again"
    if (stop.state === "resolved") return "completed"
    return stop.decision === null ? "stopped_again" : "open"
}

/** What a stop asked, as one line: the reason and the question. */
export const askedOf = (stop: RunStop): string => [stop.reason, stop.question ?? ""].join(" ").replaceAll(/\s+/g, " ").trim()

/** The run and the step an answer belongs to, as an evidence ref. */
export const stopRefOf = (runId: string, stepKey: string): string => `run:${runId}/step:${stepKey}`

/** The JSON a model answered, or null: code fences stripped, the outermost object read. */
export const modelJsonOf = (output: string): unknown => {
    const body = output.replaceAll(/```(?:json)?/gi, "")
    const from = body.indexOf("{")
    const to = body.lastIndexOf("}")
    if (from < 0 || to <= from) return null
    const read = parseJsonText(body.slice(from, to + 1))
    return read.ok ? read.value : null
}
