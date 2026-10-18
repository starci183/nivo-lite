import { ACTIVE_STATUSES } from "../bookings.contracts"
import type {
    BookableService,
    BookingModel,
    BookingResource,
    DeskRefusal,
    PlanInput,
    SlotReason,
    TakenSpan,
} from "../bookings.contracts"
import type { ResourceUtilisation } from "./availability.policy"
import { addDays, zonedMs } from "./zoned-time.policy"

const MINUTE_MS = 60_000
const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/u
const TIME_TEXT = /^\d{2}:\d{2}$/u
const TOKEN_TEXT = /^[A-Za-z0-9-]{8,64}$/u
const EMAIL_PART = /^[^@\s]+$/u

const isEmail = (value: string): boolean => {
    const at = value.indexOf("@")
    const dot = value.indexOf(".", at + 2)
    return (
        at > 0 &&
        dot > at + 1 &&
        dot < value.length - 1 &&
        EMAIL_PART.test(value.slice(0, at)) &&
        EMAIL_PART.test(value.slice(at + 1))
    )
}

/** The part of a booking the figures read. */
export interface FigureRow {
    /** The booking status. */
    readonly status: string
    /** The resource. */
    readonly resourceId: string
    /** How many customers come. */
    readonly partySize: number
    /** The start instant. */
    readonly startMs: number
    /** The end instant. */
    readonly endMs: number
    /** The price in VND, or null. */
    readonly priceVnd: number | null
}

/** What the rows of a range come to. */
export interface RangeSummary {
    /** The bookings by status. */
    readonly byStatus: Readonly<Record<string, number>>
    /** The booked minutes of each resource, weighted by party size. */
    readonly bookedByResource: ReadonlyMap<string, number>
    /** The price total of the done bookings. */
    readonly doneRevenueVnd: number
}

/** Days of approved leave of the person a resource is linked to. */
export interface LeaveDay {
    /** The resource the person serves. */
    readonly resourceId: string
    /** The person on leave. */
    readonly staffId: string
    /** The first day of leave, `YYYY-MM-DD`. */
    readonly fromDate: string
    /** The last day of leave, `YYYY-MM-DD`. */
    readonly toDate: string
}

/** A party size no resource can hold: a leave blocks its resource for the whole day. */
const LEAVE_PARTY = 1000

const BOOKED_STATUSES: ReadonlySet<string> = new Set(["confirmed", "rescheduled", "done"])

/** A phone number as `84` followed by digits, or null when there is nothing to read. */
export const normalisePhone = (raw: string): string | null => {
    const digits = raw.replace(/\D/gu, "")
    if (digits === "") return null
    if (digits.startsWith("0")) return `84${digits.slice(1)}`
    return !digits.startsWith("84") && digits.length === 9 ? `84${digits}` : digits
}

/** Whether a normalised phone has a plausible number of digits. */
export const isPlausiblePhone = (phone: string | null): phone is string =>
    phone !== null && phone.length >= 8 && phone.length <= 15

/** A booking phone as digits, or nothing when the text had no digits. */
export type OptionalBookingPhone = string | null

/** The phone digits a chat booking stores: the same normalisation the desk uses. */
export const normaliseBookingPhone = (raw: string): OptionalBookingPhone => normalisePhone(raw)

/** Whether those digits are a plausible phone. */
export const isPlausibleBookingPhone = (phone: OptionalBookingPhone): phone is string => isPlausiblePhone(phone)

/** A lower-case email of at most 120 characters, or null when it is not an address. */
export const normaliseEmail = (raw: string): string | null => {
    const value = raw.trim()
    return isEmail(value) ? value.toLowerCase().slice(0, 120) : null
}

/** The deposit due for a price, rounded to a whole VND; none without a price or a percentage. */
export const depositFor = (priceVnd: number | null, depositPct: number): number =>
    priceVnd !== null && priceVnd > 0 && depositPct > 0 ? Math.round((priceVnd * depositPct) / 100) : 0

/** Sums the bookings of a range: by status, booked minutes per resource and the revenue of the done ones. */
export const summariseRange = (rows: ReadonlyArray<FigureRow>): RangeSummary => {
    const byStatus: Record<string, number> = {}
    const bookedByResource = new Map<string, number>()
    let doneRevenueVnd = 0
    for (const row of rows) {
        byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
        if (BOOKED_STATUSES.has(row.status)) {
            const minutes = ((row.endMs - row.startMs) / MINUTE_MS) * row.partySize
            bookedByResource.set(row.resourceId, (bookedByResource.get(row.resourceId) ?? 0) + minutes)
        }
        if (row.status === "done") doneRevenueVnd += row.priceVnd ?? 0
    }
    return { byStatus, bookedByResource, doneRevenueVnd }
}

/** The share of no-shows among the finished bookings, rounded; null when none finished. */
export const noShowShare = (done: number, noShow: number): number | null =>
    done + noShow > 0 ? Math.round((noShow / (done + noShow)) * 100) : null

/** The open-time weighted utilisation of all resources, or null when no resource has open hours. */
export const weightedUtilisation = (perResource: ReadonlyArray<ResourceUtilisation>): number | null => {
    const open = perResource.reduce((sum, r) => sum + r.openMin, 0)
    return open > 0 ? Math.round(perResource.reduce((sum, r) => sum + r.pct * r.openMin, 0) / open) : null
}

/** How many of the rows start inside [fromMs, toMs) and are not cancelled. */
export const startingBetween = (rows: ReadonlyArray<FigureRow>, fromMs: number, toMs: number): number =>
    rows.filter((r) => r.status !== "cancelled" && r.startMs >= fromMs && r.startMs < toMs).length

/** The resource a free-pick add settles on when no slot is free and the owner insists: the first active one of the kind the service needs. */
export const fallbackResource = (
    resources: ReadonlyArray<BookingResource>,
    resourceKind: string | null,
): BookingResource | null =>
    resources.find((r) => r.active && (resourceKind === null || r.kind === resourceKind)) ?? null

/** Whole-day blocks for the approved leave of the people resources are linked to. */
export const leaveBlocks = (leaves: ReadonlyArray<LeaveDay>, timeZone: string): ReadonlyArray<TakenSpan> =>
    leaves.map((leave) => ({
        id: `leave:${leave.staffId}:${leave.fromDate}`,
        resourceId: leave.resourceId,
        startMs: zonedMs(leave.fromDate, "00:00", timeZone),
        blockEndMs: zonedMs(addDays(leave.toDate, 1), "00:00", timeZone),
        partySize: LEAVE_PARTY,
    }))

/** Why an owner add found no free resource, in the words of the desk. */
export const deskReasonOf = (why: Exclude<SlotReason, "free">): DeskRefusal =>
    why === "closed" || why === "full" || why === "no_resource" ? why : "datetime_invalid"

/** The party size of a public form: a whole number from one to twenty. */
export const clampParty = (party: number): number => Math.min(20, Math.max(1, Math.round(party) || 1))

/** The idempotency key of a form token, or null when the token is not usable. */
export const idempotencyKeyOf = (token: string): string | null => (TOKEN_TEXT.test(token) ? `public:${token}` : null)

/** Whether texts are a `YYYY-MM-DD` date and an `HH:MM` time. */
export const isLocalDateTime = (date: string, time: string): boolean => DATE_TEXT.test(date) && TIME_TEXT.test(time)

/** The planner input for one service of a workspace model. */
export const planInputOf = (
    model: BookingModel,
    service: BookableService,
    taken: ReadonlyArray<TakenSpan>,
    nowMs: number,
    partySize: number,
): PlanInput => ({
    service: {
        id: service.id,
        durationMin: service.durationMin,
        bufferMin: service.bufferMin,
        resourceKind: service.resourceKind,
        active: service.active,
    },
    resources: model.resources,
    hours: model.hours,
    exceptions: model.exceptions,
    taken,
    policy: {
        timezone: model.settings.timezone,
        slotStepMin: model.settings.slotStepMin,
        minLeadMin: model.settings.minLeadMin,
        maxAdvanceDays: model.settings.maxAdvanceDays,
    },
    nowMs,
    partySize,
})

/** Whether a booking status is still ahead of the customer. */
export const isActiveStatus = (status: string): boolean => {
    const statuses: ReadonlyArray<string> = ACTIVE_STATUSES
    return statuses.includes(status)
}
