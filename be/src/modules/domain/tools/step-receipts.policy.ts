import type { SubjectRef } from "@nivo-lite/agent-sdk/node"

/** One write a run step made, as the effect ledger kept it (`GraphNodeEffectsService.recordsOf`): what, with what, its answer, when. */
export interface StepReceipt {
    /** The effect. */
    readonly effect: string
    /** The arguments it ran with; null when they were not kept. */
    readonly args: Readonly<Record<string, unknown>> | null
    /** What it answered (the receipt's result). */
    readonly subject: SubjectRef
    /** When it was kept (ISO text). */
    readonly at: string
}

/** A founder's answer as the turn carries it: when, and `engine` for the engine's own words among them (an approved call's answer). */
interface TurnAnswer {
    /** The words, when the turn carries them (not read here). */
    readonly text?: string | undefined
    /** When (ISO text). */
    readonly at: string
}

/** The `by` of the words the engine writes among the founder's answers: no person's words. */
const ENGINE_WORDS = "engine"

/** A stored time as epoch milliseconds, or null. */
const timeOf = (value: string): number | null => {
    const time = Date.parse(value)
    return Number.isFinite(time) ? time : null
}

/**
 * When the step's present stretch of attempts began: the newest answer IN WORDS of a person (the engine's own words, a button, a
 * deadline are none), or null when no person answered in words. A person's words are new facts: what the step did before them is
 * done and told, and the step may act again on them (tell the customer how it ended). Retries, approvals, deadlines and re-drives
 * carry no new words, so the step replays what it did since then.
 */
export const stretchStartOf = (answers: ReadonlyArray<TurnAnswer> | undefined): number | null => {
    const times = (answers ?? [])
        .filter((answer) => Reflect.get(answer, "by") !== ENGINE_WORDS)
        .map((answer) => timeOf(answer.at))
        .filter((time): time is number => time !== null)
    return times.length === 0 ? null : Math.max(...times)
}

/** A value as JSON text with its object members in name order, so the same arguments read the same whatever order they came in. */
const canonicalOf = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalOf).join(",")}]`
    if (typeof value === "object" && value !== null) {
        const entries = Object.entries(value)
            .filter(([, member]) => member !== undefined)
            .toSorted(([left], [right]) => left.localeCompare(right))
        return `{${entries.map(([name, member]) => `${JSON.stringify(name)}:${canonicalOf(member)}`).join(",")}}`
    }
    return JSON.stringify(value) ?? "null"
}

/** True when two argument records are the same call's (member order aside). */
export const sameArguments = (
    left: Readonly<Record<string, unknown>> | null,
    right: Readonly<Record<string, unknown>>,
): boolean => left !== null && canonicalOf(left) === canonicalOf(right)

/** Where a call stands among the step's calls of the same effect in the present attempt (1 = its first call of that effect). */
export interface ReceiptAsk {
    /** The effect. */
    readonly effect: string
    /** The arguments the present attempt calls it with. */
    readonly args: Readonly<Record<string, unknown>>
    /** Its position among this attempt's calls of the effect, from 1. */
    readonly position: number
    /** When the present attempt began (ISO text). */
    readonly startedAt: string
    /** The founder's answers the turn carries. */
    readonly answers: ReadonlyArray<TurnAnswer> | undefined
}

/**
 * The receipt a write of a step that runs AGAIN answers instead of acting (nivo-frame `rights` 11d, `engine-core` 3: a replay makes the
 * same calls in the same order and the kept results match by position): the receipt of the step's call of the same effect at the same
 * position, made in an EARLIER attempt of this stretch (after the newest words of a person, before the present attempt began). The
 * same arguments are no business of this rule (the ledger answers them under their own key: null); other arguments at that position are
 * the replay of a call that already happened (a retry with no words, a crash re-drive, a resume after an approval): its receipt
 * answers, the call is not made again. Null when no earlier attempt of the stretch made that call: it acts for real.
 */
export const receiptAt = (receipts: ReadonlyArray<StepReceipt>, ask: ReceiptAsk): StepReceipt | null => {
    const began = timeOf(ask.startedAt)
    if (began === null || ask.position < 1) return null
    const stretch = stretchStartOf(ask.answers)
    const earlier = receipts
        .filter((receipt) => receipt.effect === ask.effect)
        .filter((receipt) => {
            const at = timeOf(receipt.at)
            return at !== null && at < began && (stretch === null || at > stretch)
        })
        .toSorted((left, right) => left.at.localeCompare(right.at))
    const kept = earlier[ask.position - 1]
    if (kept === undefined || sameArguments(kept.args, ask.args)) return null
    return kept
}
