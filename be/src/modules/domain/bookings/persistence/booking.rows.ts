import type {
    BookableService,
    BookingResource,
    BookingSettings,
    BookingStatus,
    DateException,
    ServiceSpec,
    TakenSpan,
    WeeklyHours,
} from "../bookings.contracts"
import type { FigureRow, LeaveDay } from "../policies/booking-rules.policy"
import { hhmmOf } from "../policies/zoned-time.policy"

/** One row of the settings select. */
export interface SettingsRow {
    /** The timezone. */
    readonly timezone: string
    /** The slot step min. */
    readonly slot_step_min: number
    /** The min lead min. */
    readonly min_lead_min: number
    /** The max advance days. */
    readonly max_advance_days: number
    /** The cancel window hours. */
    readonly cancel_window_hours: number
    /** The deposit pct. */
    readonly deposit_pct: number
    /** The late cancel fee pct. */
    readonly late_cancel_fee_pct: number
    /** The no show fee vnd. */
    readonly no_show_fee_vnd: number
    /** The auto confirm. */
    readonly auto_confirm: boolean
    /** The handoff order. */
    readonly handoff_order: boolean
    /** The reminder hours. */
    readonly reminder_hours: ReadonlyArray<number>
    /** The public enabled. */
    readonly public_enabled: boolean
    /** The public slug. */
    readonly public_slug: string | null
    /** The public note. */
    readonly public_note: string
    /** The address. */
    readonly address: string
}

/** One row of the published page select. */
export interface PageRow {
    /** The workspace id. */
    readonly workspace_id: string
    /** The public note. */
    readonly public_note: string
    /** The address. */
    readonly address: string
    /** The timezone. */
    readonly timezone: string
    /** The shop. */
    readonly shop: string
}

/** One row of the services select. */
export interface ServiceRow {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The description. */
    readonly description: string
    /** The duration min. */
    readonly duration_min: number
    /** The buffer min. */
    readonly buffer_min: number
    /** The price vnd. */
    readonly price_vnd: number | null
    /** The resource kind. */
    readonly resource_kind: string | null
    /** The followup days. */
    readonly followup_days: number | null
    /** The active. */
    readonly active: boolean
}

/** One row of the resources select. */
export interface ResourceRow {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The kind. */
    readonly kind: string
    /** The capacity. */
    readonly capacity: number
    /** The active. */
    readonly active: boolean
    /** The sort order. */
    readonly sort_order: number
}

/** One row of the weekly hours select. */
export interface HoursRow {
    /** The resource id. */
    readonly resource_id: string
    /** The weekday. */
    readonly weekday: number
    /** The start time. */
    readonly start_time: string
    /** The end time. */
    readonly end_time: string
}

/** One row of the exceptions select. */
export interface ExceptionRow {
    /** The resource id. */
    readonly resource_id: string | null
    /** The on date. */
    readonly on_date: string
    /** The closed. */
    readonly closed: boolean
    /** The start time. */
    readonly start_time: string | null
    /** The end time. */
    readonly end_time: string | null
}

/** One row of the held spans select. */
export interface SpanRow {
    /** The id. */
    readonly id: string
    /** The resource id. */
    readonly resource_id: string
    /** The party size. */
    readonly party_size: number
    /** The start ms. */
    readonly start_ms: number
    /** The block end ms. */
    readonly block_end_ms: number
}

/** One row of the leave days select. */
export interface LeaveDayRow {
    /** The resource id. */
    readonly resource_id: string
    /** The leave staff. */
    readonly leave_staff: string
    /** The from date. */
    readonly from_date: string
    /** The to date. */
    readonly to_date: string
}

/** One locked booking row with the timing of its service. */
export interface BookingStateRow {
    /** The id. */
    readonly id: string
    /** The resource id. */
    readonly resource_id: string
    /** The party size. */
    readonly party_size: number
    /** The status. */
    readonly status: BookingStatus
    /** The duration min. */
    readonly duration_min: number
    /** The buffer min. */
    readonly buffer_min: number
    /** The start ms. */
    readonly start_ms: number
}

/** The service as the planner sees it. */
export const toServiceSpec = (row: ServiceRow): ServiceSpec => ({
    id: row.id,
    durationMin: row.duration_min,
    bufferMin: row.buffer_min,
    resourceKind: row.resource_kind,
    active: row.active,
})

/** The resource as the planner sees it. */
export const toResource = (row: ResourceRow): BookingResource => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    capacity: row.capacity,
    active: row.active,
    sort: row.sort_order,
})

/** The weekly window as the planner sees it. */
export const toWeeklyHours = (row: HoursRow): WeeklyHours => ({
    resourceId: row.resource_id,
    weekday: row.weekday,
    start: hhmmOf(row.start_time),
    end: hhmmOf(row.end_time),
})

/** The exception as the planner sees it. */
export const toDateException = (row: ExceptionRow): DateException => ({
    resourceId: row.resource_id,
    date: row.on_date,
    closed: row.closed,
    start: row.start_time === null ? null : hhmmOf(row.start_time),
    end: row.end_time === null ? null : hhmmOf(row.end_time),
})

/** The held span as the planner sees it. */
export const toTakenSpan = (row: SpanRow): TakenSpan => ({
    id: row.id,
    resourceId: row.resource_id,
    startMs: row.start_ms,
    blockEndMs: row.block_end_ms,
    partySize: row.party_size,
})

/** One row of the bookings-of-a-window selects. */
export interface WindowRow {
    /** The status. */
    readonly status: string
    /** The resource id. */
    readonly resource_id: string
    /** The party size. */
    readonly party_size: number
    /** The price vnd. */
    readonly price_vnd: number | null
    /** The start ms. */
    readonly start_ms: number
    /** The end ms. */
    readonly end_ms: number
}

/** One row of the finished counts select. */
export interface FinishedCountRow {
    /** The status. */
    readonly status: string
    /** The total. */
    readonly total: number
}

/** The row of the deposits-due select. */
export interface DepositsRow {
    /** The total. */
    readonly total: number
    /** The amount vnd. */
    readonly amount_vnd: number
}

/** The existing booking an idempotency key found. */
export interface KeyedBookingRow {
    /** The id. */
    readonly id: string
    /** The status. */
    readonly status: string
    /** The holds slot. */
    readonly holds_slot: boolean
}

/** The settings of a workspace that never saved any. */
export const DEFAULT_SETTINGS: BookingSettings = {
    timezone: "Asia/Ho_Chi_Minh",
    slotStepMin: 15,
    minLeadMin: 60,
    maxAdvanceDays: 60,
    cancelWindowHours: 24,
    depositPct: 0,
    lateCancelFeePct: 0,
    noShowFeeVnd: 0,
    autoConfirm: true,
    handoffOrder: false,
    reminderHours: [24, 2],
    publicEnabled: false,
    publicSlug: null,
    publicNote: "",
    address: "",
}

/** The settings a row holds. */
export const toSettings = (row: SettingsRow): BookingSettings => ({
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
    reminderHours: row.reminder_hours,
    publicEnabled: row.public_enabled,
    publicSlug: row.public_slug,
    publicNote: row.public_note,
    address: row.address,
})

/** The service the owner sees. */
export const toBookable = (row: ServiceRow): BookableService => ({
    id: row.id,
    name: row.name,
    description: row.description,
    durationMin: row.duration_min,
    bufferMin: row.buffer_min,
    priceVnd: row.price_vnd,
    resourceKind: row.resource_kind,
    active: row.active,
})

/** The leave days as the rules read them. */
export const toLeaveDay = (row: LeaveDayRow): LeaveDay => ({
    resourceId: row.resource_id,
    staffId: row.leave_staff,
    fromDate: row.from_date,
    toDate: row.to_date,
})

/** The window row as the figures read it. */
export const toFigureRow = (row: WindowRow): FigureRow => ({
    status: row.status,
    resourceId: row.resource_id,
    partySize: row.party_size,
    startMs: row.start_ms,
    endMs: row.end_ms,
    priceVnd: row.price_vnd,
})
