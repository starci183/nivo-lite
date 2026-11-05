import { monthStartMs, shopDayOf } from "./shop-time"

/** The reporting periods the workbench offers: the shop's calendar month now, and the one before. */
export type PeriodKey = "this" | "last"

/** The periods in the order the workbench lists them. */
export const PERIOD_KEYS: readonly [PeriodKey, PeriodKey] = ["this", "last"]

/** A reporting period: a half-open range of shop calendar days. */
export interface Period {
    /** Which period. */
    readonly key: PeriodKey
    /** The first instant of the period, ISO text. */
    readonly fromIso: string
    /** The first instant after the period, ISO text. */
    readonly toIso: string
    /** The first day of the period, `YYYY-MM-DD`. */
    readonly fromDay: string
    /** The first day after the period, `YYYY-MM-DD`. */
    readonly toDay: string
}

/** The period `key` as seen at `now`: the shop's calendar month, from its first instant to the first instant of the next. */
export const periodOf = (now: Date, key: PeriodKey): Period => {
    const from = new Date(monthStartMs(now, key === "this" ? 0 : 1))
    const to = new Date(monthStartMs(now, key === "this" ? -1 : 0))
    return {
        key,
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
        fromDay: shopDayOf(from.toISOString()),
        toDay: shopDayOf(to.toISOString()),
    }
}

/** What stops a period from closing. */
export type CloseBlocker = "period_open" | "unmatched_payments" | "waiting_questions"

/** What the close of a period looks at. */
export interface CloseInput {
    /** The period to close. */
    readonly period: Period
    /** The instant of the check. */
    readonly now: Date
    /** How many payments of the period are unmatched or wait for review. */
    readonly unmatchedPayments: number
    /** How many accounting questions still wait for the owner. */
    readonly waitingQuestions: number
}

/** The verdict on closing a period: the blockers in the order they are worked off, empty when it may close. */
export interface CloseVerdict {
    /** Whether nothing stops the close. */
    readonly canClose: boolean
    /** What stops it. */
    readonly blockers: ReadonlyArray<CloseBlocker>
}

/**
 * A period may close once it is over, every payment in it is tied to what it paid and no question about it waits for the owner. The
 * check only reads; closing never rewrites an entry (a correction after the close is a new adjustment entry).
 */
export const closeVerdict = (input: CloseInput): CloseVerdict => {
    const blockers: Array<CloseBlocker> = []
    if (input.now.getTime() < Date.parse(input.period.toIso)) blockers.push("period_open")
    if (input.unmatchedPayments > 0) blockers.push("unmatched_payments")
    if (input.waitingQuestions > 0) blockers.push("waiting_questions")
    return { canClose: blockers.length === 0, blockers }
}
