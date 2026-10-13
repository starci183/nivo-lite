const DAY_MS = 86_400_000

/** The product time zone: days and months follow Vietnam time. */
export const TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The calendar day (YYYY-MM-DD) of an instant in Vietnam time. */
export const vietnamDay = (instant: Date): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(instant)

/** A calendar day (YYYY-MM-DD) moved by a number of days. */
export const addDays = (day: string, count: number): string =>
    new Date(new Date(`${day}T00:00:00Z`).getTime() + count * DAY_MS).toISOString().slice(0, 10)
