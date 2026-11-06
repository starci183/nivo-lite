/** How many days a followed-up deal waits for its next step when the owner names none. */
export const DEFAULT_FOLLOW_DAYS = 2

const DAY_MS = 86_400_000

/** When a followed-up step is due again: the given days after now (two by default), ISO text. */
export const dueAfter = (now: Date, days: number | undefined): string =>
    new Date(now.getTime() + (days ?? DEFAULT_FOLLOW_DAYS) * DAY_MS).toISOString()
