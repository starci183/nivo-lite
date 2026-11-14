/**
 * Calendar arithmetic in a workspace's time zone (an IANA name, the core's `workspaces.time_zone`; the engine passes it, the one default is
 * `DEFAULT_TIME_ZONE` of `entities/workspace/time-zone.ts`). Exact: it reads the zone's rules through `Intl`, summer time included,
 * never a fixed offset.
 */

/** The wall-clock fields of an instant in a zone. */
interface WallClock {
    readonly year: number
    readonly month: number
    readonly day: number
    readonly hour: number
    readonly minute: number
    readonly second: number
}

/** The formatter of a zone's wall clock, built once per zone. */
const formatters = new Map<string, Intl.DateTimeFormat>()

const formatterOf = (timeZone: string): Intl.DateTimeFormat => {
    const held = formatters.get(timeZone)
    if (held !== undefined) return held
    const made = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    })
    formatters.set(timeZone, made)
    return made
}

/** The wall clock of an instant in a zone. */
const wallClockOf = (ms: number, timeZone: string): WallClock => {
    const parts = formatterOf(timeZone).formatToParts(new Date(ms))
    const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((one) => one.type === type)?.value ?? "0")
    return {
        year: part("year"),
        month: part("month"),
        day: part("day"),
        hour: part("hour"),
        minute: part("minute"),
        second: part("second"),
    }
}

/** How far the zone's wall clock is ahead of UTC at an instant, in milliseconds (negative west of Greenwich). */
export const zoneOffsetMsAt = (ms: number, timeZone: string): number => {
    const wall = wallClockOf(ms, timeZone)
    const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
    return asUtc - Math.floor(ms / 1000) * 1000
}

/** The calendar day (`YYYY-MM-DD`) an instant falls on in a zone. */
export const zoneDayOf = (ms: number, timeZone: string): string => {
    const wall = wallClockOf(ms, timeZone)
    return `${String(wall.year).padStart(4, "0")}-${String(wall.month).padStart(2, "0")}-${String(wall.day).padStart(2, "0")}`
}

/** The month (1 to 12) an instant falls in, in a zone. */
export const zoneMonthOf = (ms: number, timeZone: string): number => wallClockOf(ms, timeZone).month

/** The instant a wall-clock moment of a day (`YYYY-MM-DD`, at `minuteOfDay` minutes after midnight) happens in a zone. */
export const zoneMomentMs = (day: string, minuteOfDay: number, timeZone: string): number => {
    const wall = Date.parse(`${day}T00:00:00.000Z`) + minuteOfDay * 60_000
    // The offset at the moment itself: guessed from the wall clock read as UTC, then read again at the guess (a summer-time change
    // between the two moves it once).
    const first = wall - zoneOffsetMsAt(wall, timeZone)
    return wall - zoneOffsetMsAt(first, timeZone)
}

/** The instant a day (`YYYY-MM-DD`) starts in a zone: its local midnight. */
export const zoneDayStartMs = (day: string, timeZone: string): number => zoneMomentMs(day, 0, timeZone)
