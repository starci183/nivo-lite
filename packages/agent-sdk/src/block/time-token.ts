import type { TimeWindow } from "./list.types"

/**
 * The time tokens a filter value or a read variable may carry in place of a literal: the host resolves them on the server from the
 * clock of the run, never a block or the front end, so a spec says "today" and the read answers for the day it runs.
 */
export const TIME_TOKENS = ["$today", "$thisWeek", "$thisMonth"] as const

/** One time token. */
export type TimeToken = (typeof TIME_TOKENS)[number]

/** The tokens as a set, to ask a text whether it is one. */
const TOKEN_SET: ReadonlySet<string> = new Set(TIME_TOKENS)

/** Whether a value is a time token. */
export const isTimeToken = (value: unknown): value is TimeToken => typeof value === "string" && TOKEN_SET.has(value)

/** Milliseconds in one day. */
const DAY_MS = 86_400_000

/** Days in a week and the offset that makes Monday its first day (`getUTCDay` counts Sunday as 0). */
const WEEK_DAYS = 7
const FROM_MONDAY = 6

/** The window a token names around an instant: the UTC day, the UTC week from Monday, or the UTC calendar month. */
export const timeWindowOf = (token: TimeToken, now: Date): TimeWindow => {
    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const dayStart = Date.UTC(year, month, now.getUTCDate())
    const [from, to] = ((): readonly [number, number] => {
        switch (token) {
            case "$today":
                return [dayStart, dayStart + DAY_MS]
            case "$thisWeek": {
                const monday = dayStart - ((now.getUTCDay() + FROM_MONDAY) % WEEK_DAYS) * DAY_MS
                return [monday, monday + WEEK_DAYS * DAY_MS]
            }
            case "$thisMonth":
                return [Date.UTC(year, month, 1), Date.UTC(year, month + 1, 1)]
        }
    })()
    return { from: new Date(from).toISOString(), to: new Date(to).toISOString() }
}
