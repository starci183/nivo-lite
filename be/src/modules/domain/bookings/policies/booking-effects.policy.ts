import type { BookingEventKind } from "../bookings.contracts"

const HOUR_MS = 3_600_000

/** Reasons an owner gives when cancelling: the customer owes nothing for these. */
const OWNER_REASONS: ReadonlyArray<string> = ["owner", "owner_cancelled"]

/** The kinds of notice a customer gets. */
export type NoticeKind = "confirmed" | "moved" | "cancelled"

/** Whether a cancellation came too close to the start (inside the cancel window). */
export const isLateCancel = (startMs: number, cancelledMs: number | null, windowHours: number): boolean =>
    cancelledMs !== null && startMs - cancelledMs < windowHours * HOUR_MS

/** The fee of a cancellation: the late-cancel percentage of the price when the customer cancelled late, otherwise none. An owner's own cancellation is free. */
export const cancelFeeOf = (
    row: {
        readonly price_vnd: number | null
        readonly cancel_reason: string | null
        readonly start_ms: number
        readonly cancelled_ms: number | null
    },
    windowHours: number,
    feePct: number,
): number => {
    if (row.cancel_reason !== null && OWNER_REASONS.includes(row.cancel_reason)) return 0
    if (row.price_vnd === null || row.price_vnd <= 0 || feePct <= 0) return 0
    return isLateCancel(row.start_ms, row.cancelled_ms, windowHours) ? Math.round((row.price_vnd * feePct) / 100) : 0
}

/** Which notice an event earns, or null when the customer is not told. */
export const noticeOf = (kind: BookingEventKind, status: string): NoticeKind | null => {
    if (status === "cancelled") return "cancelled"
    if (kind === "moved" || status === "rescheduled") return "moved"
    return status === "confirmed" ? "confirmed" : null
}

/** The mark that keeps one notice from going out twice for the same state of the booking. */
export const noticeMark = (notice: NoticeKind, rescheduleCount: number): string =>
    notice === "moved" ? `notice:moved:${rescheduleCount}` : `notice:${notice}`
