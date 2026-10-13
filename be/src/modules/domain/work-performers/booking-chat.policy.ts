import { localHhmm } from "@modules/domain/bookings"

const DAY_MS = 86_400_000

/** True when a local HH:MM time lies in the period the customer named (an open end is no limit). */
export const withinPeriod = (hhmm: string, from: string | null, to: string | null): boolean =>
    (from === null || hhmm >= from) && (to === null || hhmm < to)

/** The first distinct local start times of ISO instants, as "HH:MM, HH:MM", or empty when there are none. */
export const offeredTimes = (isoTimes: ReadonlyArray<string>, zone: string, max: number): string =>
    [...new Set(isoTimes.map((iso) => localHhmm(Date.parse(iso), zone)))].slice(0, max).join(", ")

/** The ISO instant one day after another. */
export const addDayIso = (iso: string): string => new Date(Date.parse(iso) + DAY_MS).toISOString()
