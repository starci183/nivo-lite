const DAY_MS = 86_400_000

/** The new paid-until instant: `days` after the current one, or after now when the subscription already lapsed. */
export const extendedPaidUntil = (current: Date | null, now: Date, days: number): Date =>
    new Date(Math.max(current?.getTime() ?? 0, now.getTime()) + days * DAY_MS)
