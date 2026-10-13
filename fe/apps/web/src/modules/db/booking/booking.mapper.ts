import type { Database } from "../../../../../../../supabase/types/database.types"
import { isoDayNumber, shiftDate, wallClockText, wallDate, wallMinutes } from "@/modules/i18n"

import type {
    BookingBoard,
    BookingFiguresView,
    BookingHoursView,
    BookingResourceView,
    BookingServiceView,
    BookingSettingsView,
    BookingStatsView,
    BookingView,
} from "@/modules/types"

type Tables = Database["public"]["Tables"]

/** The default business time zone of a workspace that never saved booking settings. */
const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The raw rows one board is built from. */
export interface BoardRows {
    readonly settings: Tables["booking_settings"]["Row"] | null
    readonly services: ReadonlyArray<Tables["booking_services"]["Row"]>
    readonly resources: ReadonlyArray<Tables["booking_resources"]["Row"]>
    readonly hours: ReadonlyArray<Tables["booking_hours"]["Row"]>
    readonly exceptions: ReadonlyArray<Tables["booking_exceptions"]["Row"]>
    readonly bookings: ReadonlyArray<Tables["bookings"]["Row"]>
    readonly waitlist: ReadonlyArray<Tables["booking_waitlist"]["Row"]>
    readonly staff: ReadonlyArray<Pick<Tables["staff"]["Row"], "id" | "name">>
    /** The statuses of the bookings that finished in the last 30 days. */
    readonly finished: ReadonlyArray<Pick<Tables["bookings"]["Row"], "status">>
    /** The deposits of the live bookings that are still due. */
    readonly deposits: ReadonlyArray<Pick<Tables["bookings"]["Row"], "deposit_vnd">>
}

const DEFAULT_SETTINGS: BookingSettingsView = {
    timezone: DEFAULT_TIME_ZONE,
    slotStepMin: 15,
    minLeadMin: 60,
    maxAdvanceDays: 60,
    cancelWindowHours: 24,
    depositPct: 0,
    lateCancelFeePct: 0,
    noShowFeeVnd: 0,
    autoConfirm: true,
    handoffOrder: false,
    address: "",
    publicEnabled: false,
    publicSlug: null,
    publicNote: "",
}

const toSettings = (row: Tables["booking_settings"]["Row"] | null): BookingSettingsView =>
    row === null
        ? DEFAULT_SETTINGS
        : {
              timezone: row.timezone,
              slotStepMin: row.slot_step_min,
              minLeadMin: row.min_lead_min,
              maxAdvanceDays: row.max_advance_days,
              cancelWindowHours: row.cancel_window_hours,
              depositPct: row.deposit_pct,
              lateCancelFeePct: row.late_cancel_fee_pct,
              noShowFeeVnd: row.no_show_fee_vnd,
              autoConfirm: row.auto_confirm,
              handoffOrder: row.handoff_order,
              address: row.address,
              publicEnabled: row.public_enabled,
              publicSlug: row.public_slug,
              publicNote: row.public_note,
          }

const clock = (value: string): string => value.slice(0, 5)

const bookingOf = (
    row: Tables["bookings"]["Row"],
    services: ReadonlyArray<BookingServiceView>,
    timezone: string,
): BookingView => {
    const startMs = Date.parse(row.start_at)
    const endMs = Date.parse(row.end_at)
    const date = wallDate(startMs, timezone)
    const startMin = wallMinutes(startMs, timezone)
    const endMin = wallDate(endMs, timezone) === date ? wallMinutes(endMs, timezone) : 24 * 60
    return {
        id: row.id,
        customer: row.customer_name,
        phone: row.customer_phone,
        serviceId: row.service_id,
        service: services.find((service) => service.id === row.service_id)?.name ?? "",
        resourceId: row.resource_id,
        startMs,
        endMs,
        date,
        startMin,
        endMin,
        startClock: wallClockText(startMin),
        endClock: wallClockText(endMin),
        status: row.status,
        holdsSlot: row.holds_slot,
        party: row.party_size,
        priceVnd: row.price_vnd,
        depositVnd: row.deposit_vnd,
        depositStatus: row.deposit_status,
        feeVnd: row.cancel_fee_vnd,
        checkedIn: row.checked_in_at !== null,
        note: row.note,
        conflictNote: row.conflict_note,
        source: row.source_channel,
        leadId: row.lead_id,
        reschedules: row.reschedule_count,
    }
}

const MINUTES_OF_DAY = 24 * 60
const BOOKED = ["confirmed", "rescheduled", "done"]

const minutesOf = (clockText: string): number => Number(clockText.slice(0, 2)) * 60 + Number(clockText.slice(3, 5))

/** The utilisation of each active resource: the booked minutes over the weekly opening minutes of the days in the range. */
const utilisationOf = (
    resources: ReadonlyArray<BookingResourceView>,
    hours: ReadonlyArray<BookingHoursView>,
    bookings: ReadonlyArray<BookingView>,
    from: string,
    to: string,
): BookingStatsView["byResource"] => {
    const days = Array.from({ length: 7 }, (_, index) => shiftDate(from, index)).filter((day) => day <= to)
    return resources
        .filter((resource) => resource.active)
        .map((resource) => {
            const openMin = days.reduce(
                (sum, day) =>
                    sum +
                    hours
                        .filter((row) => row.resourceId === resource.id && row.weekday === isoDayNumber(day))
                        .reduce((inner, row) => inner + Math.max(0, minutesOf(row.end) - minutesOf(row.start)), 0),
                0,
            )
            const bookedMin = bookings
                .filter((booking) => booking.resourceId === resource.id && BOOKED.includes(booking.status))
                .reduce((sum, booking) => sum + (booking.endMin - booking.startMin) * booking.party, 0)
            return {
                resourceId: resource.id,
                name: resource.name,
                openMin,
                bookedMin,
                pct: openMin > 0 ? Math.min(100, Math.round((bookedMin / openMin) * 100)) : 0,
            }
        })
}

const statsOf = (board: Pick<BookingBoard, "resources" | "hours" | "bookings" | "from" | "to">): BookingStatsView => {
    const byStatus: Record<string, number> = {}
    for (const booking of board.bookings) byStatus[booking.status] = (byStatus[booking.status] ?? 0) + 1
    const finished = (byStatus.done ?? 0) + (byStatus.no_show ?? 0)
    return {
        byResource: utilisationOf(board.resources, board.hours, board.bookings, board.from, board.to),
        byStatus,
        noShowPct: finished > 0 ? Math.round(((byStatus.no_show ?? 0) / finished) * 100) : 0,
        doneRevenueVnd: board.bookings
            .filter((booking) => booking.status === "done")
            .reduce((sum, booking) => sum + (booking.priceVnd ?? 0), 0),
        total: board.bookings.length,
    }
}

/** The part of a board the figures of the ribbon are counted from. */
interface FigureBoard extends Pick<BookingBoard, "today" | "bookings"> {
    readonly stats: BookingStatsView
}

const figuresOf = (rows: BoardRows, board: FigureBoard): BookingFiguresView => {
    const open = board.stats.byResource.reduce((sum, row) => sum + row.openMin, 0)
    const noShows = rows.finished.filter((row) => row.status === "no_show").length
    return {
        bookingsToday: board.bookings.filter(
            (booking) => booking.date === board.today && booking.status !== "cancelled",
        ).length,
        noShowPct30d: rows.finished.length > 0 ? Math.round((noShows / rows.finished.length) * 100) : null,
        finished30d: rows.finished.length,
        utilisationPct:
            open > 0
                ? Math.round(board.stats.byResource.reduce((sum, row) => sum + row.pct * row.openMin, 0) / open)
                : null,
        depositsPending: rows.deposits.length,
        depositsPendingVnd: rows.deposits.reduce((sum, row) => sum + Number(row.deposit_vnd), 0),
    }
}

/** Builds the board of one range of local dates from the rows the database answered. */
export const boardOf = (rows: BoardRows, from: string, to: string, nowMs: number): BookingBoard => {
    const settings = toSettings(rows.settings)
    const timezone = settings.timezone
    const services: ReadonlyArray<BookingServiceView> = rows.services.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        durationMin: row.duration_min,
        bufferMin: row.buffer_min,
        priceVnd: row.price_vnd,
        resourceKind: row.resource_kind,
        followupDays: row.followup_days,
        active: row.active,
    }))
    const base = {
        timezone,
        today: wallDate(nowMs, timezone),
        nowMs,
        from,
        to,
        settings,
        services,
        resources: rows.resources.map((row) => ({
            id: row.id,
            name: row.name,
            kind: row.kind,
            capacity: row.capacity,
            color: row.color,
            active: row.active,
            staffId: row.staff_id,
        })),
        hours: rows.hours.map((row) => ({
            resourceId: row.resource_id,
            weekday: row.weekday,
            start: clock(row.start_time),
            end: clock(row.end_time),
        })),
        exceptions: rows.exceptions.map((row) => ({
            id: row.id,
            resourceId: row.resource_id,
            date: row.on_date,
            closed: row.closed,
            start: row.start_time === null ? null : clock(row.start_time),
            end: row.end_time === null ? null : clock(row.end_time),
            note: row.note,
        })),
        bookings: rows.bookings.map((row) => bookingOf(row, services, timezone)),
        waitlist: rows.waitlist.map((row) => ({
            id: row.id,
            customer: row.customer_name,
            phone: row.customer_phone,
            service: services.find((service) => service.id === row.service_id)?.name ?? "",
            fromMs: Date.parse(row.window_start),
            toMs: Date.parse(row.window_end),
            party: row.party_size,
            status: row.status,
        })),
        staff: rows.staff.map((row) => ({ id: row.id, name: row.name })),
    }
    const stats = statsOf(base)
    return { ...base, stats, figures: figuresOf(rows, { ...base, stats }) }
}
