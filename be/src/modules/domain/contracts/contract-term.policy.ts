import { isIsoDay } from "./contract.policy"

/** One term of a contract: its first day and its last day, YYYY-MM-DD. */
export interface ContractTerm {
    /** The first day, YYYY-MM-DD. */
    readonly startsOn: string
    /** The last day, YYYY-MM-DD. */
    readonly endsOn: string
}

/** The length a contract with no usable term renews by: one year. */
const FALLBACK_MONTHS = 12
const DAY_MS = 86_400_000

const dayOf = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

const isoOf = (date: Date): string => date.toISOString().slice(0, 10)

const addDays = (iso: string, days: number): string => isoOf(new Date(dayOf(iso).getTime() + days * DAY_MS))

const daysInMonth = (year: number, monthIndex: number): number => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()

/** The same day `months` months later; a day the target month does not have is clamped to its last day (31 Jan + 1 month = 28 Feb). */
export const addMonths = (iso: string, months: number): string => {
    const from = dayOf(iso)
    const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1))
    const day = Math.min(from.getUTCDate(), daysInMonth(target.getUTCFullYear(), target.getUTCMonth()))
    return isoOf(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day)))
}

/** The whole number of months from `from` to `to`, or null when `to` is not a whole number of months (above 0) after `from`. */
const wholeMonths = (from: string, to: string): number | null => {
    const a = dayOf(from)
    const b = dayOf(to)
    const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
    return months > 0 && addMonths(from, months) === to ? months : null
}

/**
 * The term that follows a paid renewal of the contract `startsOn`–`endsOn`, as long as the current one. A term of whole months
 * renews by months: one that ends on the anniversary (1 Jan to 1 Jan) starts again on its last day; one that ends the day before
 * (1 Oct to 30 Sep) starts the day after and keeps ending the day before. Any other term renews by its number of days from its last
 * day. A missing or unreadable start, or a term of no length, renews by one year.
 */
export const nextTermOf = (startsOn: string | null, endsOn: string): ContractTerm => {
    const start = startsOn !== null && isIsoDay(startsOn) && startsOn < endsOn ? startsOn : null
    if (start === null) return { startsOn: endsOn, endsOn: addMonths(endsOn, FALLBACK_MONTHS) }
    const anniversary = wholeMonths(start, endsOn)
    if (anniversary !== null) return { startsOn: endsOn, endsOn: addMonths(endsOn, anniversary) }
    const dayAfter = addDays(endsOn, 1)
    const inclusive = wholeMonths(start, dayAfter)
    if (inclusive !== null) return { startsOn: dayAfter, endsOn: addDays(addMonths(dayAfter, inclusive), -1) }
    const days = Math.round((dayOf(endsOn).getTime() - dayOf(start).getTime()) / DAY_MS)
    return { startsOn: endsOn, endsOn: addDays(endsOn, days) }
}

/** A YYYY-MM-DD day as people in Vietnam write it, DD/MM/YYYY. */
export const displayDayOf = (iso: string): string => {
    const [year = "", month = "", day = ""] = iso.split("-")
    return `${day}/${month}/${year}`
}

/** The note with one more line at its end, cut from the front when it would pass `max` characters so the newest lines stay. */
export const appendNoteLine = (note: string, line: string, max: number): string => {
    const joined = note.trim() === "" ? line : `${note.trimEnd()}\n${line}`
    return joined.length <= max ? joined : joined.slice(joined.length - max)
}
