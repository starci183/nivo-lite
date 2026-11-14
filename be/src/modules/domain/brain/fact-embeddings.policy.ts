import { hasStatedPeriod, readByJudge, sameValue, valueLineOf, type FactRecord } from "@modules/domain/brain-facts"
import { JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_RETRY_MAX_TOKENS, type AiBudget } from "@modules/integrations/ai"
import type { EmbeddingsRefreshed, LineBatchEntry } from "./fact-embeddings.contracts"

/** How long one batch of fact lines may take to embed. */
export const EMBED_TIMEOUT_MS = 20_000

/** The most fact lines one embedding call carries (the passages' batch size). */
export const EMBED_BATCH = 32

/**
 * The most changed facts one announcement embeds INLINE: one embedding call's worth (`EMBED_BATCH`), under `EMBED_TIMEOUT_MS`. The write
 * that announced waits for it, so it is bounded; the rest of a bigger announcement is embedded by its `vector.sync` job (every changed
 * fact gets one) and, failing that, by the vector reconcile (tick `vector-reconcile`), which walks every row against its point.
 */
export const ANNOUNCE_INLINE_MAX = 32

/**
 * How many same-meaning judgements of one window run at once (TRIAGE-4): at effort `high` each reasons for seconds, and a window's
 * facts never judge one another, so they need not wait in line; their outcomes are still written one after the other.
 */
export const JUDGE_PARALLEL = 8

/** How long one "same fact?" judgement may take: it reasons before it answers (`JUDGE_EFFORT` high). */
export const JUDGE_TIMEOUT_MS = 120_000

/**
 * What one judgement may spend: effort high (`JUDGE_EFFORT`, the lane's table) and a cap with room for the reasoning before the few
 * tokens of the verdict (`JUDGE_MAX_TOKENS`).
 */
export const JUDGE_BUDGET: AiBudget = { effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS }

/** What the try after a CUT verdict may spend (D-N-13): more room, so it is not the same call cut at the same place. */
export const JUDGE_RETRY_BUDGET: AiBudget = { effort: JUDGE_EFFORT, maxTokens: JUDGE_RETRY_MAX_TOKENS }

/** How many tries one judgement gets when an answer is cut, failed or unreadable; after them it is `unknown`, never "different". */
export const JUDGE_TRIES = 2

/**
 * Whether the same truth holds the same value in two lines: by their one normal form when both read as one (a share, a span of the
 * clock, a length of time, a yes/no, money or a number: `sameValue` decides, D-BR-10), else by the judge's reading (an address, a free
 * text).
 */
export const valuesAgree = (fact: FactRecord, other: FactRecord, judgeSays: boolean): boolean => {
    const [one, two] = [valueLineOf(fact), valueLineOf(other)]
    if (sameValue(one, two)) return true
    return readByJudge(one) || readByJudge(two) ? judgeSays : false
}

/** What of a truth its period is read from. */
export type Dated = Pick<FactRecord, "validFrom" | "validTo">

/** The instant a bound names, or the open end when it names none. */
const boundOf = (written: string | null, open: number): number => (written === null ? open : Date.parse(written))

/**
 * Whether two truths of DIFFERENT keys, judged the same truth, hold at the same time (date arithmetic only; concept truth-graph rule 4:
 * a stated window overlays a standing value). Two standing values do; two stated periods do when they overlap; a stated period and a
 * standing value never do, whichever was filed first: the period applies for its dates and the standing value outside them.
 */
export const periodsMeet = (one: Dated, other: Dated): boolean => {
    const [first, second] = [hasStatedPeriod(one), hasStatedPeriod(other)]
    if (first !== second) return false
    if (!first) return true
    return (
        boundOf(one.validFrom, Number.NEGATIVE_INFINITY) < boundOf(other.validTo, Number.POSITIVE_INFINITY) &&
        boundOf(other.validFrom, Number.NEGATIVE_INFINITY) < boundOf(one.validTo, Number.POSITIVE_INFINITY)
    )
}

/** Whether two truths hold for exactly the same time: both standing, or the same stated period to the millisecond. */
export const samePeriod = (one: Dated, other: Dated): boolean => {
    const [first, second] = [hasStatedPeriod(one), hasStatedPeriod(other)]
    if (first !== second) return false
    if (!first) return true
    return (
        boundOf(one.validFrom, Number.NEGATIVE_INFINITY) === boundOf(other.validFrom, Number.NEGATIVE_INFINITY) &&
        boundOf(one.validTo, Number.POSITIVE_INFINITY) === boundOf(other.validTo, Number.POSITIVE_INFINITY)
    )
}

/**
 * What the brain does with a truth the judge read as THE SAME TRUTH as one of another key (`sameTruth`; false when the answer stayed
 * unreadable and the nearest candidate stands in), once the values and the periods are compared in code:
 * - `join`: the same value for the same time: a duplicate, its source joins the other truth;
 * - `ask`: the pair is linked (`same_meaning`): they hold at the same time with another value, or the judge's answer stayed
 *   unreadable. The settle of the document reads the link: a contradiction is asked of the founder;
 * - `apart`: they never hold at the same time (a standing value filed after a dated window, two windows that do not overlap), or
 *   they give the same value over periods that only overlap: two truths, nothing linked, nothing asked.
 * A dated WINDOW filed over a STANDING value keeps the link it always had, whatever the values: the settle reads that link as the
 * window's overlay (`direct-apply.policy.ts` `overlays`: the window applies for its dates, the standing value comes back after) and
 * asks nothing; without the link the window would stand beside the standing value under another key.
 * Round W, D-W-2: the same window in two documents was scheduled twice (a scheduled truth was never a candidate).
 */
export type SameTruthAct = "join" | "ask" | "apart"

/** `SameTruthAct` of a truth and the other truth the judge named (or the nearest candidate of an unreadable answer). */
export const sameTruthActOf = (
    fact: FactRecord,
    other: FactRecord,
    sameTruth: boolean,
    judgeSaysSameValue: boolean,
): SameTruthAct => {
    const agree = sameTruth && valuesAgree(fact, other, judgeSaysSameValue)
    // A window over a standing value: linked as before, for the settle to read as the window's overlay.
    if (hasStatedPeriod(fact) && !hasStatedPeriod(other)) return agree ? "join" : "ask"
    if (!periodsMeet(fact, other)) return "apart"
    if (!agree) return "ask"
    return samePeriod(fact, other) ? "join" : "apart"
}

/** A refresh that did nothing (the AI is off, or it failed). */
export const NOTHING_REFRESHED: EmbeddingsRefreshed = { embedded: 0, adopted: 0, unchanged: 0 }

/** The lines cut into batches of `EMBED_BATCH`, in order. */
export const batchesOf = (lines: ReadonlyArray<LineBatchEntry>): ReadonlyArray<ReadonlyArray<LineBatchEntry>> =>
    Array.from({ length: Math.ceil(lines.length / EMBED_BATCH) }, (_, index) =>
        lines.slice(index * EMBED_BATCH, (index + 1) * EMBED_BATCH),
    )

/**
 * Whether another truth may be offered to a judge as the same thing as this fact: another key of the same kind of row, not excluded.
 * Structure only (ids, key, kind): what the labels SAY is the judge's to read, never filtered here.
 */
export const fitsAsCandidate = (fact: FactRecord, other: FactRecord, excluded: ReadonlySet<string>): boolean =>
    other.id !== fact.id &&
    !excluded.has(other.id) &&
    other.proposalKind === "set" &&
    (other.subjectKey !== fact.subjectKey || other.attribute !== fact.attribute)

/**
 * Whether a waiting truth that the store linked to ANOTHER VALUE OF ITS OWN KEY (`conflictWith`, no `same_meaning` flag) should have
 * that pair read by the judge: the two are one key and one agent, code could not prove the values equal, and at least one of them is
 * a wording code cannot compare (`readByJudge`: "30k per order" beside "30.000 d"). Ids, keys and forms only: what the two wordings
 * mean is the judge's reading.
 */
export const sameKeyRepeatToRead = (fact: FactRecord, other: FactRecord): boolean => {
    if (fact.id === other.id || fact.subjectKey !== other.subjectKey || fact.attribute !== other.attribute) return false
    if (fact.installationId !== other.installationId) return false
    const [one, two] = [valueLineOf(fact), valueLineOf(other)]
    return !sameValue(one, two) && (readByJudge(one) || readByJudge(two))
}
