import type { RunStop } from "@modules/domain/agent-threads/stops/run-stop.contracts"

/** A line a step already sent the customer: its words and when it was sent. */
export interface SentLine {
    /** The words. */
    readonly text: string
    /** When it was sent, ISO text. */
    readonly at: string
}

/** The time of a row as ISO text, or null when the row holds none. */
const timeOf = (value: unknown): string | null => {
    if (value instanceof Date) return value.toISOString()
    return typeof value === "string" && value !== "" ? value : null
}

/** The most lines a turn is told were already sent: the newest, oldest first. */
export const ALREADY_SENT_MAX: number = 20

/** The most records of one run step read back from the ledger. */
export const STEP_RECORDS_LOOKED_AT: number = 100

/** The most stops of one customer looked at, per state. */
export const STOPS_LOOKED_AT: number = 20

/** How long the lines told for a stop that was resolved still count as told: a day. */
export const RESOLVED_STOP_COUNTS_MS: number = 24 * 60 * 60 * 1000

/** A run and a step of it. */
export interface StepPlace {
    /** The run. */
    readonly runId: string
    /** The step (its key in the graph). */
    readonly stepKey: string
}

/** The run and the step of a step key as the engines give it (`<run>:<step>`), or null for any other key. */
export const stepPlaceOf = (key: string): StepPlace | null => {
    const at = key.indexOf(":")
    return at <= 0 || at === key.length - 1 ? null : { runId: key.slice(0, at), stepKey: key.slice(at + 1) }
}

/** A row of the effect ledger (`agent_node_effects`) as the policy reads it: its data and when it was written. */
export interface LedgerRow {
    /** The record's data. */
    readonly data: Readonly<Record<string, unknown>>
    /** When it was written (ISO text): just after the call acted. */
    readonly createdAt: string
}

/** The words of a call's arguments, or null when they hold none (or were not kept). */
const wordsOf = (args: unknown): string | null => {
    const text: unknown = typeof args === "object" && args !== null ? Reflect.get(args, "text") : undefined
    return typeof text === "string" && text !== "" ? text : null
}

/**
 * The lines told to a customer among the ledger records of a step, oldest first: the records of the effects named (the customer
 * send), with the words of their kept arguments and the time they were kept. A record whose arguments were not kept says nothing.
 */
export const ledgerLinesOf = (rows: ReadonlyArray<LedgerRow>, effects: ReadonlyArray<string>): ReadonlyArray<SentLine> =>
    rows
        .flatMap((row) => {
            const text = wordsOf(row.data.args)
            return typeof row.data.effectId === "string" && effects.includes(row.data.effectId) && text !== null
                ? [{ text, at: row.createdAt }]
                : []
        })
        .sort((left, right) => left.at.localeCompare(right.at))

/** What the founder decided on a report about the customer: what the report asked, the founder's words, and when. */
export interface FounderDecision {
    /** The report's question, else its reason. */
    readonly question: string
    /** The founder's words. */
    readonly answer: string
    /** When the founder answered, ISO text. */
    readonly at: string
}

/** What a stop says the customer was told: its run and step, the lines it holds, and when it was resolved (null while open). */
export interface StopTold {
    /** The run of the stop. */
    readonly runId: string
    /** The step of the stop. */
    readonly stepKey: string
    /** The lines the stop holds (the engine's holding line and those recorded on it). */
    readonly lines: ReadonlyArray<SentLine>
    /** When it was resolved, ISO text; null while open. */
    readonly resolvedAt: string | null
    /** What the founder answered on it in words, oldest first (D-MX-1): the founder's decisions for this customer. */
    readonly decisions: ReadonlyArray<FounderDecision>
}

/** The text of a value, or null when it holds none. */
const textOrNull = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null)

/** The founder's answers in words a stop keeps (its answers of kind `answer`), each with the question they answer. */
const decisionsOf = (stop: RunStop): ReadonlyArray<FounderDecision> => {
    const question = textOrNull(stop.question) ?? textOrNull(stop.reason) ?? ""
    return stop.answers.flatMap((answer) => {
        if (answer.kind !== "answer") return []
        const text = textOrNull(answer.text)
        const at = timeOf(answer.at)
        return text !== null && at !== null ? [{ question, answer: text, at }] : []
    })
}

/** What a stop says the customer was told: its run and step, the lines it holds (with words and a time), its resolution and decisions. */
export const stopToldOf = (stop: RunStop): StopTold => ({
    runId: stop.runId,
    stepKey: stop.stepKey,
    lines: stop.customerLines.flatMap((line) => {
        const text = wordsOf(line)
        const at = timeOf(line.at)
        return text !== null && at !== null ? [{ text, at }] : []
    }),
    resolvedAt: timeOf(stop.resolvedAt),
    decisions: decisionsOf(stop),
})

/** The most founder decisions a turn is told: the newest, oldest first. */
export const FOUNDER_DECISIONS_MAX: number = 10

/**
 * What the founder decided for the customer of a turn on the reports of OTHER steps (D-MX-1): the answers in words of every stop that
 * counts, except the turn's own stop (its answers ride `founderAnswers`), each once, oldest first, the newest `FOUNDER_DECISIONS_MAX`.
 * Facts only: the agent reads them as the shop's decisions for this customer.
 */
export const founderDecisionsOf = (
    stops: ReadonlyArray<StopTold>,
    own: StepPlace | null,
): ReadonlyArray<FounderDecision> => {
    const seen = new Set<string>()
    return stops
        .filter((stop) => own?.runId !== stop.runId || own.stepKey !== stop.stepKey)
        .flatMap((stop) => stop.decisions)
        .toSorted((left, right) => left.at.localeCompare(right.at))
        .filter((decision) => {
            const key = `${decision.at}\u0000${decision.answer}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
        .slice(-FOUNDER_DECISIONS_MAX)
}

/**
 * True for a stop whose lines still count as told to the customer at `now`: an open one, or one resolved within the last day. With no
 * clock, only an open one.
 */
export const stopCounts = (stop: StopTold, now: Date | null): boolean => {
    if (stop.resolvedAt === null) return true
    if (now === null) return false
    return now.getTime() - Date.parse(stop.resolvedAt) <= RESOLVED_STOP_COUNTS_MS
}

/**
 * The lines a turn is told were already sent: each wording once (its first time), oldest first, the newest `ALREADY_SENT_MAX` only.
 * Facts only; the agent decides what is new.
 */
export const alreadySentOf = (lines: ReadonlyArray<SentLine>): ReadonlyArray<SentLine> => {
    const first = new Map<string, SentLine>()
    lines
        .toSorted((left, right) => left.at.localeCompare(right.at))
        .forEach((line) => {
            if (!first.has(line.text)) first.set(line.text, line)
        })
    return [...first.values()].slice(-ALREADY_SENT_MAX)
}

/** The subject kinds a ledger record keeps for a call that did NOT act: a refusal, and an act whose outcome is unknown. */
const NOT_DONE_SUBJECTS: ReadonlySet<string> = new Set(["refused", "outcome-unknown"])

/**
 * The effects a run step already did, from its own ledger records (D-W8-1): each effect id once, in name order, of the records that
 * acted and were not taken back. A refusal, an act whose outcome is unknown and an undone act did nothing that a `requires` may count.
 */
export const doneEffectsOf = (rows: ReadonlyArray<LedgerRow>): ReadonlyArray<string> =>
    [
        ...new Set(
            rows.flatMap((row) => {
                const { effectId, subjectEntity, undoneAt } = row.data
                const acted =
                    typeof effectId === "string" &&
                    effectId !== "" &&
                    !(typeof subjectEntity === "string" && NOT_DONE_SUBJECTS.has(subjectEntity)) &&
                    (undoneAt === null || undoneAt === undefined)
                return acted ? [effectId] : []
            }),
        ),
    ].toSorted()
