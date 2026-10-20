const HOUR_MS = 3_600_000
/** Vietnam is UTC+7 all year. */
const VN_OFFSET_MS = 7 * HOUR_MS
/** The default publish hour, Vietnam time. */
export const DEFAULT_PUBLISH_HOUR = 9
/** A requested moment must be at least this far ahead to be kept. */
const MIN_AHEAD_MS = 15 * 60_000

/**
 * The moment a post is published: the requested moment when it is valid and at least fifteen minutes ahead, else the next day at
 * 09:00 Vietnam time.
 */
export const publishMomentOf = (now: Date, requested: string | null): Date => {
    const asked = requested === null ? Number.NaN : Date.parse(requested)
    if (Number.isFinite(asked) && asked - now.getTime() >= MIN_AHEAD_MS) return new Date(asked)
    const local = new Date(now.getTime() + VN_OFFSET_MS)
    const nextDay = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, DEFAULT_PUBLISH_HOUR)
    return new Date(nextDay - VN_OFFSET_MS)
}
