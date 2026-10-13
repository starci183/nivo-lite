const HOUR_MS = 3_600_000

/** A reminder due before a booking starts. */
export interface ReminderDue {
    /** The kind, `h24` for twenty-four hours before. */
    readonly kind: string
    /** The instant the reminder is due. */
    readonly dueMs: number
}

/** The reminders still ahead of `nowMs`, one per distinct offset in hours before the start. */
export const reminderPlan = (
    startMs: number,
    hours: ReadonlyArray<number>,
    nowMs: number,
): ReadonlyArray<ReminderDue> =>
    [...new Set(hours)]
        .map((h) => ({ kind: `h${h}`, dueMs: startMs - h * HOUR_MS }))
        .filter((reminder) => reminder.dueMs > nowMs)

/** The reminder offsets in hours the owner set on the appointment reminder card, none when the card has no usable number. */
export const cardReminderHours = (config: Readonly<Record<string, unknown>> | null): ReadonlyArray<number> =>
    [config?.firstHours, config?.secondHours].map(Number).filter((hours) => Number.isFinite(hours) && hours > 0)
