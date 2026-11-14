import { zoneDayOf, zoneDayStartMs } from "../zone-time"
import type { MessageRole } from "./message"

const MINUTE_MS = 60_000

/** One line of a conversation, as far as the response time cares. */
export interface TimedLine {
    /** The role of the line. */
    readonly role: MessageRole
    /** The moment of the line, as ISO 8601. */
    readonly at: string
}

/** The median of the values (the mean of the two middle ones for an even count); null for none. */
export const medianOf = (values: ReadonlyArray<number>): number | null => {
    if (values.length === 0) return null
    const sorted = values.toSorted((left, right) => left - right)
    const middle = sorted.slice(Math.floor((sorted.length - 1) / 2), Math.floor(sorted.length / 2) + 1)
    return middle.reduce((sum, value) => sum + value, 0) / middle.length
}

/** Minutes from the customer's first line to the first agent line after it; null when either is missing. Lines are oldest first. */
export const firstResponseMinutes = (lines: ReadonlyArray<TimedLine>): number | null => {
    const user = lines.find((line) => line.role === "user")
    if (user === undefined) return null
    const userAt = Date.parse(user.at)
    const reply = lines.find((line) => line.role === "agent" && Date.parse(line.at) > userAt)
    return reply === undefined ? null : (Date.parse(reply.at) - userAt) / MINUTE_MS
}

/** The median first response in minutes, to two decimals; null when no conversation has one. */
export const responseMedianOf = (minutes: ReadonlyArray<number>): number | null => {
    const median = medianOf(minutes)
    return median === null ? null : Math.round(median * 100) / 100
}

/** The start of the day, in the workspace's time zone, that contains the instant, in epoch milliseconds. */
export const shopDayStartOf = (nowMs: number, timeZone: string): number =>
    zoneDayStartMs(zoneDayOf(nowMs, timeZone), timeZone)
