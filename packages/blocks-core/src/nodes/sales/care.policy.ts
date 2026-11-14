/**
 * The care timing a node still computes: EXACT date arithmetic on instants the tools answer and on `ctx.run.at`, and the
 * exact reading of an order status. Nothing here reads meaning (the customer's delivery words go to `ctx.agent.run`), builds a timer key,
 * or parses lead memory (the opt-out and the occasions come from `nivo.tool.lead.care.get` already typed).
 */

/** The care steps a timer can wake the Sales agent for: the `kind` a node arms `nivo.tool.timer.arm` with. */
export const CARE_KINDS: readonly ["payment-reminder", "payment-stale", "delivery-check", "occasion"] = [
    "payment-reminder",
    "payment-stale",
    "delivery-check",
    "occasion",
]

/** One care step. */
export type CareKind = (typeof CARE_KINDS)[number]

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000
/** Vietnam is seven hours ahead of UTC and keeps no summer time. */
const VIETNAM_OFFSET_MS = 7 * 3_600_000
/** The longest a care step may be scheduled ahead (the schedule tool refuses farther). */
const SCHEDULE_AHEAD_MAX_DAYS = 90
/** Slack after which a woken timer counts as due: the wake clock is a minute sweep. */
const DUE_SLACK_MS = 2 * MINUTE_MS

/** The instant of an ISO string as a Date. */
const dateOf = (iso: string): Date => new Date(Date.parse(iso))

/** Whether a moment is a real appointment: a valid instant, not farther ahead than care ever plans. */
export const schedulable = (dueAt: string, at: string): boolean => {
    const due = Date.parse(dueAt)
    return !Number.isNaN(due) && due <= Date.parse(at) + SCHEDULE_AHEAD_MAX_DAYS * DAY_MS
}

/** The moment a number of minutes after another, as an ISO string. */
export const afterMinutes = (at: string, minutes: number): string =>
    new Date(Date.parse(at) + minutes * MINUTE_MS).toISOString()

/** The moment a day after another, as an ISO string. */
export const dayAfter = (at: string): string => new Date(Date.parse(at) + DAY_MS).toISOString()

/** Whether a care step's moment has come (a timer that woke early is armed again, not acted on); no moment means it is due. */
export const isDue = (dueAt: string | null, at: string): boolean =>
    dueAt === null || Date.parse(dueAt) <= Date.parse(at) + DUE_SLACK_MS

/** The calendar day (`YYYY-MM-DD`) an instant falls on in Vietnam: the day of an occasion's instant (a node's "today" is `ctx.run.day`). */
export const vietnamDayOf = (at: string): string =>
    new Date(Date.parse(at) + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)

/** What the payment of an order has come to when a care wake looks at it. */
export type PaymentState = "paid" | "closed" | "open"

/** The state of an order's payment from its status (an exact reading of a fixed set): paid, closed for good, or still open. */
export const paymentStateOf = (status: string | null): PaymentState => {
    if (status === "paid") return "paid"
    return status === null || status === "cancelled" || status === "failed_system" ? "closed" : "open"
}

/** A date the customer mentioned, as `nivo.tool.lead.care.get` answers it. */
export interface CareOccasion {
    /** The occasion's own id (the timer's `item`). */
    readonly occasionId: string
    /** What it is, in the customer's words (a birthday, an anniversary). */
    readonly label: string
    /** The month, 1 to 12. */
    readonly month: number
    /** The day of the month. */
    readonly day: number
    /** The year, when the customer gave one that makes it a one-off; null for a yearly date. */
    readonly year: number | null
}

/** The day of an occasion: what the arithmetic needs of it. */
export type OccasionDay = Pick<CareOccasion, "month" | "day" | "year">

/** The next time an occasion falls on or after a moment (Vietnam midnight of the day), or null for a one-off date that has passed. */
export const nextOccurrenceOf = (occasion: OccasionDay, at: string): Date | null => {
    const now = dateOf(at)
    const midnight = (year: number): Date =>
        new Date(Date.UTC(year, occasion.month - 1, occasion.day) - VIETNAM_OFFSET_MS)
    if (occasion.year !== null) {
        const once = midnight(occasion.year)
        return once.getTime() >= now.getTime() ? once : null
    }
    const thisYear = midnight(new Date(now.getTime() + VIETNAM_OFFSET_MS).getUTCFullYear())
    return thisYear.getTime() >= now.getTime()
        ? thisYear
        : midnight(new Date(thisYear.getTime() + VIETNAM_OFFSET_MS).getUTCFullYear() + 1)
}

/** Where an occasion stands: `later` (before the lead time, with the moment to write), `due` (inside the lead time), `gone`. */
export type OccasionStanding =
    | { readonly kind: "later"; readonly writeAt: string; readonly on: string }
    | { readonly kind: "due"; readonly on: string }
    | { readonly kind: "gone" }

/** Where an occasion stands at a moment, given how many days before it the shop writes. */
export const occasionStandingOf = (occasion: OccasionDay, at: string, leadDays: number): OccasionStanding => {
    const on = nextOccurrenceOf(occasion, at)
    if (on === null) return { kind: "gone" }
    const writeAt = on.getTime() - leadDays * DAY_MS
    return Date.parse(at) >= writeAt
        ? { kind: "due", on: on.toISOString() }
        : { kind: "later", writeAt: new Date(writeAt).toISOString(), on: on.toISOString() }
}

/**
 * The moment to write about a yearly date after the occurrence just handled (`on`): the lead time before its next occurrence; null for a
 * one-off date.
 */
export const nextYearsWriteAtOf = (occasion: OccasionDay, on: string, leadDays: number): string | null => {
    if (occasion.year !== null) return null
    const following = nextOccurrenceOf(occasion, dayAfter(on))
    return following === null ? null : new Date(following.getTime() - leadDays * DAY_MS).toISOString()
}

const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/u
/** The hour of the day, UTC, a delivery counts as made at when its check-in is planned (UTC 02:00 is 09:00 in Vietnam). */
const DELIVERY_CHECK_HOUR_UTC = 2
/** How far back a delivery day may be and still be believed (the customer may say "today"), and how far ahead. */
const DELIVERY_PAST_MAX_MS = DAY_MS
const DELIVERY_AHEAD_MAX_DAYS = 90

/**
 * The calendar day (`YYYY-MM-DD`) the agent read the customer's delivery words as, when it is a well-formed day close enough to `at` to be
 * believed; else null. A FORMAT and RANGE check on the agent's answer, not a reading of the words.
 */
export const deliveryDayOf = (value: string | null, at: string): string | null => {
    if (value === null || !DAY_SHAPE.test(value)) return null
    const day = Date.parse(`${value}T00:00:00.000Z`)
    if (Number.isNaN(day)) return null
    const now = Date.parse(at)
    const nearEnough = day >= now - DELIVERY_PAST_MAX_MS - DAY_MS && day <= now + DELIVERY_AHEAD_MAX_DAYS * DAY_MS
    return nearEnough ? value : null
}

/** The moment to ask how the order was: the morning after the delivery day. */
export const deliveryCheckAtOf = (day: string): string =>
    new Date(Date.parse(`${day}T00:00:00.000Z`) + DAY_MS + DELIVERY_CHECK_HOUR_UTC * 3_600_000).toISOString()

/** How long a check-in with no known delivery day first waits before it looks: two days. */
export const SHIP_FIRST_LOOK_MINUTES: number = 2 * 24 * 60

/** How long each further look for the shipment waits: one day. */
export const SHIP_NEXT_LOOK_MINUTES: number = 24 * 60

/** How many looks a check-in whose delivery day is not known makes for the shipment before it stops quietly. */
export const SHIP_WAITS_MAX = 3
