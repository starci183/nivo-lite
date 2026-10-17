/** The pgmq queue of the shift alerts: the minute tick, the shift reminders and the no-show checks (one processor takes every job). */
export const SHIFTS_QUEUE = "shifts_alerts"

/** The job of a minute tick: find the reminders and no-show checks that are due, queue them, and close the month where it is time. */
export const SHIFTS_TICK_JOB = "shifts.tick"

/** The job that reminds the person of one shift before it starts. */
export const SHIFTS_REMIND_JOB = "shifts.remind"

/** The job that alerts the managers when nobody checked in to one shift. */
export const SHIFTS_NOSHOW_JOB = "shifts.noshow"

/** The payload of a minute tick. */
export interface ShiftsTickPayload {
    /** Always `tick`. */
    readonly kind: "tick"
}

/** The payload of a reminder or a no-show check of one shift. */
export interface ShiftAlertPayload {
    /** `remind` before the shift, `noshow` after its start. */
    readonly kind: "remind" | "noshow"
    /** The workspace. */
    readonly workspaceId: string
    /** The shift. */
    readonly shiftId: string
}

/** What one job of the queue asks: a tick, or a reminder or a no-show check of one shift. */
export type ShiftsJobPayload = ShiftsTickPayload | ShiftAlertPayload

/** The identity of a reminder: one per shift and person, so a swapped shift reminds its new person once. */
export const remindDedupeKey = (shiftId: string, staffId: string): string =>
    `${SHIFTS_REMIND_JOB}:${shiftId}:${staffId}`

/** The identity of a no-show check: one per shift and person. */
export const noShowDedupeKey = (shiftId: string, staffId: string): string =>
    `${SHIFTS_NOSHOW_JOB}:${shiftId}:${staffId}`
