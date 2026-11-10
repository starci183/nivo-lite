import { HOLDING_LINE_KEY_PREFIX } from "@modules/domain/chat-records"

/** The reason of the refusal a step reads when it would tell a customer again what it already told them for the same stop. */
export const ALREADY_TOLD = "already_told_for_this_stop"

/** The data kind of the lines of a conversation, as the node data ports name it. */
export const LINE_KIND = "message"

/** The most agent lines of a conversation looked at to find what a step already sent there, newest first. */
export const LINES_LOOKED_AT = 20

/** A line a step sent in a conversation: its words and when it was sent (ISO text). */
export interface ToldLine {
    /** The words. */
    readonly text: string
    /** When it was sent. */
    readonly at: string
}

/** A founder's answer to the report of a step, as the turn carries it. */
interface FounderAnswer {
    /** When the founder answered (ISO text). */
    readonly at: string
}

/** The start of the key every line of a step is kept under in a conversation: `line:<run>:<step>:` (the step key is `<run>:<step>`). */
const linePrefixOf = (stepKey: string): string => `line:${stepKey}:`

/**
 * The key the engine's own holding line of a stopped step is kept under (`line:honest-line:<run>:<step>`): the one line the AI core
 * may tell the customer when the step stops. It is sent by the engine, not by the step's agent, yet it is what the customer was told
 * for that stop, so it counts like a line of the step.
 */
const holdingRefOf = (stepKey: string): string => `line:${HOLDING_LINE_KEY_PREFIX}${stepKey}`

/** A stored time as epoch milliseconds, or null when it is no time. */
const timeOf = (value: unknown): number | null => {
    const time = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : Number.NaN
    return Number.isFinite(time) ? time : null
}

/**
 * The newest line the step itself sent in a conversation BEFORE its present attempt began (or the engine's holding line of that step's
 * stop), among the conversation's agent lines, or null when there is none. A line kept under the step's own key from before this attempt can only be there because the step ran
 * before and did not complete (a completed step is not run again): it is what the step told the customer for its stop. A line of the
 * present attempt, of another step, of a person, or with no words does not count, so a step may say several things in one attempt.
 */
export const toldBefore = (
    rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
    stepKey: string,
    startedAt: string,
): ToldLine | null => {
    const prefix = linePrefixOf(stepKey)
    const holding = holdingRefOf(stepKey)
    const began = timeOf(startedAt)
    if (began === null) return null
    const mine = rows.flatMap((row) => {
        const at = timeOf(row.sentAt)
        const kept =
            typeof row.channelRef === "string" && (row.channelRef.startsWith(prefix) || row.channelRef === holding)
        return kept && typeof row.text === "string" && row.text !== "" && at !== null && at < began
            ? [{ text: row.text, at }]
            : []
    })
    const [newest] = mine.toSorted((left, right) => right.at - left.at)
    return newest === undefined ? null : { text: newest.text, at: new Date(newest.at).toISOString() }
}

/**
 * True when a person answered the step's report after the line was sent: the stop moved on a person's word, so the step may tell the
 * customer how it ended. A retry with no words, a resume by a timer or a re-drive carries no newer answer and lifts nothing.
 */
export const answeredSince = (answers: ReadonlyArray<FounderAnswer> | undefined, line: ToldLine): boolean => {
    const sent = timeOf(line.at)
    return sent !== null && (answers ?? []).some((answer) => (timeOf(answer.at) ?? Number.NEGATIVE_INFINITY) > sent)
}
