import type { LessonCandidate, LessonCandidateThen, LessonFactKey } from "@modules/domain/brain-lessons"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { RunStop } from "./run-stop.contracts"
import type { LearningValidity } from "./stop-learning.contracts"

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
 * that answer is still being applied (not yet known: left for a later settle).
 */
export const answeredOf = (stop: RunStop): ReadonlyArray<StopAnswered> => {
    if (stop.kind !== "ai_report") return []
    return stop.answers.flatMap((answer, index): Array<StopAnswered> => {
        const text = answer.text?.trim() ?? ""
        if (answer.kind !== "answer" || text === "") return []
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
export const askedOf = (stop: RunStop): string => [stop.reason, stop.question ?? ""].join(" ").replace(/\s+/g, " ").trim()

/** The run and the step an answer belongs to, as an evidence ref. */
export const stopRefOf = (runId: string, stepKey: string): string => `run:${runId}/step:${stepKey}`

/** The standing instructions of the cheap judgement made at answer time. */
export const JUDGE_SYSTEM: string = [
    "An AI assistant of a shop could not handle a case and asked the shop owner. You read the owner's answer.",
    "Decide whether the answer states a GENERAL rule for the future (e.g. 'từ giờ…', 'luôn…', 'lần sau…', 'khách quen thì…', 'mọi đơn…',",
    "'always', 'from now on') or only decides this one case.",
    'Reply with ONLY JSON: {"general": true} or {"general": false}.',
].join("\n")

/** The user message of the judgement. */
export const judgePrompt = (asked: string, answer: string): string => `QUESTION:\n${asked}\n\nOWNER'S ANSWER:\n${answer}`

/** The standing instructions of the one draft call per group. */
export const DRAFT_SYSTEM: string = [
    "An AI assistant of a shop stopped at the same step and asked the shop owner; below are its questions and the owner's answers.",
    "Write ONE truth (a shop rule) that would have let the assistant handle these cases alone next time.",
    "Use ONLY what the owner said: never add a condition, an amount, an exception or a step the owner did not say.",
    "A truth is about the SHOP's rule, never about one customer: no customer name, phone, order code or account number.",
    "subject and attribute are short labels in the owner's language, built from the words of the questions (so a search finds it);",
    "value is the rule in the owner's words; topic is a short phrase (max 12 words) of what was asked.",
    "If the answers disagree with each other, do not write a rule: name the two answers that disagree.",
    "If no rule can be stated from the owner's words, say so.",
    'Reply with ONLY JSON, one of: {"verdict":"draft","subject":string,"attribute":string,"value":string,"unit":string|null,"valid_to":"YYYY-MM-DD"|null,"topic":string}',
    '| {"verdict":"contradiction","subject":string,"attribute":string,"topic":string,"answers":[number,number]} | {"verdict":"none"}.',
    "valid_to only when the owner stated an end (e.g. 'tuần này'); else null.",
].join("\n")

/** The user message of the draft: each answered stop as a numbered block, oldest first. */
export const draftPrompt = (group: ReadonlyArray<LessonCandidate>): string =>
    group
        .map(
            (candidate, index) =>
                `[${index + 1}] QUESTION: ${candidate.question}\nOWNER'S ANSWER: ${candidate.answer}\nTHEN THE STEP: ${candidate.thenDid}`,
        )
        .join("\n\n")

/** The JSON a model answered, or null: code fences stripped, the outermost object read. */
export const modelJsonOf = (output: string): unknown => {
    const body = output.replace(/```(?:json)?/gi, "")
    const from = body.indexOf("{")
    const to = body.lastIndexOf("}")
    if (from < 0 || to <= from) return null
    const read = parseJsonText(body.slice(from, to + 1))
    return read.ok ? read.value : null
}

/** The judgement a model answered: true, false, or null when it is not the expected JSON. */
export const judgedOf = (output: string): boolean | null => {
    const json = modelJsonOf(output)
    return isRecord(json) && typeof json.general === "boolean" ? json.general : null
}

/** A drafted truth. */
export interface LearningDraft {
    readonly verdict: "draft"
    readonly factKey: LessonFactKey
    readonly value: string
    readonly unit: string | null
    readonly validity: LearningValidity | null
    readonly topic: string
}

/** Two answers of the group disagree (1-based positions in the prompt). */
export interface LearningContradiction {
    readonly verdict: "contradiction"
    readonly factKey: LessonFactKey
    readonly topic: string
    readonly answers: readonly [number, number]
}

/** What the draft call answered; null = not the expected JSON (a failed try). */
export type LearningVerdict = LearningDraft | LearningContradiction | { readonly verdict: "none" } | null

const textOf = (json: Record<string, unknown>, name: string, max: number): string | null => {
    const value = json[name]
    return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** The verdict of a draft answer. */
export const verdictOf = (output: string): LearningVerdict => {
    const json = modelJsonOf(output)
    if (!isRecord(json)) return null
    if (json.verdict === "none") return { verdict: "none" }
    const subject = textOf(json, "subject", 120)
    const attribute = textOf(json, "attribute", 120)
    const topic = textOf(json, "topic", 160)
    if (subject === null || attribute === null || topic === null) return null
    const factKey = { subjectLabel: subject, attributeLabel: attribute }
    if (json.verdict === "contradiction") {
        const pair = Array.isArray(json.answers) ? json.answers.filter((one): one is number => Number.isInteger(one)) : []
        const [first, second] = pair
        if (first === undefined || second === undefined || first === second) return null
        return { verdict: "contradiction", factKey, topic, answers: [first, second] }
    }
    const value = textOf(json, "value", 500)
    if (json.verdict !== "draft" || value === null) return null
    const validTo = typeof json.valid_to === "string" && DATE.test(json.valid_to) ? json.valid_to : null
    return {
        verdict: "draft",
        factKey,
        value,
        unit: textOf(json, "unit", 40),
        validity: validTo === null ? null : { from: null, to: validTo },
        topic,
    }
}
