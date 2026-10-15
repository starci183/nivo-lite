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

/** The wording the owner set on the appointment reminder card, or null when there is none. */
export const cardReminderBody = (body: string | null | undefined): string | null => {
    const trimmed = body?.trim() ?? ""
    return trimmed === "" ? null : trimmed
}

/** The offsets and the wording the owner set on the reminder card. */
export interface ReminderCard {
    /** The hours before the start, none when the card sets none. */
    readonly hours: ReadonlyArray<number>
    /** The owner's own wording, or null for the fixed one. */
    readonly body: string | null
}

/** A reminder that is due, taken by a tick. */
export interface DueReminder {
    /** The reminder row. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The booking. */
    readonly bookingId: string
    /** The kind, `h24` for twenty-four hours before. */
    readonly kind: string
    /** The instant it was due. */
    readonly dueMs: number
}

/** How many hours before the start a reminder kind is, 0 when the kind carries no number. */
export const hoursOfKind = (kind: string): number => Number(kind.slice(1)) || 0
