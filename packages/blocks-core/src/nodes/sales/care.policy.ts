import { MAX_LINE } from "../../bounds"

/** The care steps a timer can wake the Sales agent for. */
export const CARE_KINDS: readonly ["payment-reminder", "payment-stale", "delivery-check", "occasion"] = [
    "payment-reminder",
    "payment-stale",
    "delivery-check",
    "occasion",
]

/** One care step. */
export type CareKind = (typeof CARE_KINDS)[number]

/** The name of the event a due care step wakes the agent with (`trigger.context.event`). */
export const CARE_DUE_EVENT = "care.due"

/** The prefix of the key of the agent task that holds a due care step. */
export const CARE_TASK_PREFIX = "care"

const KEY_SEPARATOR = ":"
const TITLE_PREFIX = "care due "
const MINUTE_MS = 60_000
const DAY_MS = 86_400_000
/** Vietnam is seven hours ahead of UTC and keeps no summer time. */
const VIETNAM_OFFSET_MS = 7 * 3_600_000
/** The longest a care step may be scheduled ahead (a timer farther than that is armed again when it wakes). */
const SCHEDULE_AHEAD_MAX_DAYS = 90
/** Slack after which a woken timer counts as due: the wake clock is a minute sweep. */
const DUE_SLACK_MS = 2 * MINUTE_MS

/** The care step a value names, or null. */
export const careKindOf = (value: unknown): CareKind | null => CARE_KINDS.find((kind) => kind === value) ?? null

/** A care step as the agent task of a timer keeps it. */
export interface CareTask {
    /** The step. */
    readonly kind: CareKind
    /** The record it is about: the order, or the customer for an occasion. */
    readonly ref: string
    /** Tells two steps of one kind on one record apart (the occasion), or empty. */
    readonly suffix: string
    /** When the step is really due, which can be later than the task's own wake (a task wakes at most seven days ahead). */
    readonly dueAt: string
}

/** The key of the agent task of a care step: once per step and record, so arming it again moves the same task. */
export const careTaskKeyOf = (kind: CareKind, ref: string, suffix: string): string =>
    [CARE_TASK_PREFIX, kind, ref, ...(suffix === "" ? [] : [suffix])].join(KEY_SEPARATOR)

/** The title of the agent task of a care step: it carries the moment the step is really due. */
export const careTaskTitleOf = (dueAt: string): string => `${TITLE_PREFIX}${dueAt}`

/** The care step an agent task holds, or null for a task that is not one. */
export const careTaskOf = (key: string, title: string): CareTask | null => {
    if (!key.startsWith(`${CARE_TASK_PREFIX}${KEY_SEPARATOR}`) || !title.startsWith(TITLE_PREFIX)) return null
    const [, kind, ref, ...rest] = key.split(KEY_SEPARATOR)
    const careKind = careKindOf(kind)
    const dueAt = title.slice(TITLE_PREFIX.length)
    if (careKind === null || ref === undefined || ref === "" || Number.isNaN(Date.parse(dueAt))) return null
    return { kind: careKind, ref, suffix: rest.join(KEY_SEPARATOR), dueAt }
}

/** Whether a moment is a real appointment: a valid instant, not farther ahead than care ever plans. */
export const schedulable = (dueAt: string, now: Date): boolean => {
    const at = Date.parse(dueAt)
    return !Number.isNaN(at) && at <= now.getTime() + SCHEDULE_AHEAD_MAX_DAYS * DAY_MS
}

/** The moment a number of minutes after now, as an ISO string. */
export const afterMinutes = (now: Date, minutes: number): string =>
    new Date(now.getTime() + minutes * MINUTE_MS).toISOString()

/** The moment a day after another, as an ISO string. */
export const dayAfter = (at: Date): string => new Date(at.getTime() + DAY_MS).toISOString()

/** Whether a care step's moment has come (a timer that woke early is armed again, not acted on); no moment means it is due. */
export const isDue = (dueAt: string | null, now: Date): boolean =>
    dueAt === null || Date.parse(dueAt) <= now.getTime() + DUE_SLACK_MS

/** What the payment of an order has come to when a care wake looks at it. */
export type PaymentState = "paid" | "closed" | "open"

/** The state of an order's payment from its status: paid, closed for good (cancelled, failed or gone), or still open. */
export const paymentStateOf = (status: string | null): PaymentState => {
    if (status === "paid") return "paid"
    return status === null || status === "cancelled" || status === "failed_system" ? "closed" : "open"
}

/** A date the customer mentioned that the shop could remind them of before it comes. */
export interface CareOccasion {
    /** What it is, in the customer's words (a birthday, an anniversary). */
    readonly label: string
    /** The month, 1 to 12. */
    readonly month: number
    /** The day of the month. */
    readonly day: number
    /** The year, when the customer gave one that makes it a one-off. */
    readonly year: number | null
}

/** What the consult found out about the customer that care reads. */
export interface CareFacts {
    /** Who the purchase is for, or null. */
    readonly recipient: string | null
    /** When the customer wants the order, in their words, or null. */
    readonly deliveryAt: string | null
    /** Where to deliver, or null. */
    readonly address: string | null
    /** True when the customer asked not to be written to unprompted. */
    readonly optedOut: boolean
    /** The dates the customer mentioned. */
    readonly occasions: ReadonlyArray<CareOccasion>
}

/** A customer about whom nothing is known. */
export const NO_CARE_FACTS: CareFacts = {
    recipient: null,
    deliveryAt: null,
    address: null,
    optedOut: false,
    occasions: [],
}

const DATE_SHAPE = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/

const textOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, MAX_LINE) : null

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const occasionOf = (value: unknown): CareOccasion | null => {
    if (!isObject(value)) return null
    const label = textOf(value["label"])
    const date = DATE_SHAPE.exec(textOf(value["date"]) ?? "")
    if (label === null || date === null) return null
    const month = Number(date[2])
    const day = Number(date[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return { label, month, day, year: date[1] === undefined ? null : Number(date[1]) }
}

/**
 * What care reads from the customer's consult facts, however much of it is there: the recipient, the delivery time and address the
 * consult kept, `careOptOut` when the customer asked to be left alone, and `occasions` (`[{ label, date }]`, `date` as `MM-DD` for a
 * yearly one or `YYYY-MM-DD` for a one-off). Anything unreadable counts as not known.
 */
export const careFactsOf = (stored: unknown): CareFacts => {
    if (!isObject(stored)) return NO_CARE_FACTS
    const listed: ReadonlyArray<unknown> = Array.isArray(stored["occasions"]) ? stored["occasions"] : []
    return {
        recipient: textOf(stored["recipient"]),
        deliveryAt: textOf(stored["deliveryAt"]),
        address: textOf(stored["address"]),
        optedOut: stored["careOptOut"] === true,
        occasions: listed.flatMap((entry) => {
            const occasion = occasionOf(entry)
            return occasion === null ? [] : [occasion]
        }),
    }
}

/** The next time an occasion falls on or after now (Vietnam midnight of the day), or null for a one-off date that has passed. */
export const nextOccurrenceOf = (occasion: CareOccasion, now: Date): Date | null => {
    const at = (year: number): Date => new Date(Date.UTC(year, occasion.month - 1, occasion.day) - VIETNAM_OFFSET_MS)
    if (occasion.year !== null) {
        const once = at(occasion.year)
        return once.getTime() >= now.getTime() ? once : null
    }
    const thisYear = at(new Date(now.getTime() + VIETNAM_OFFSET_MS).getUTCFullYear())
    return thisYear.getTime() >= now.getTime() ? thisYear : at(new Date(thisYear.getTime() + VIETNAM_OFFSET_MS).getUTCFullYear() + 1)
}

/** Where an occasion stands: `later` (before the lead time, with the moment to write), `due` (inside the lead time), `gone`. */
export type OccasionStanding =
    | { readonly kind: "later"; readonly writeAt: string; readonly on: string }
    | { readonly kind: "due"; readonly on: string }
    | { readonly kind: "gone" }

/** Where an occasion stands now, given how many days before it the shop writes. */
export const occasionStandingOf = (occasion: CareOccasion, now: Date, leadDays: number): OccasionStanding => {
    const on = nextOccurrenceOf(occasion, now)
    if (on === null) return { kind: "gone" }
    const writeAt = on.getTime() - leadDays * DAY_MS
    return now.getTime() >= writeAt
        ? { kind: "due", on: on.toISOString() }
        : { kind: "later", writeAt: new Date(writeAt).toISOString(), on: on.toISOString() }
}

/** The part of an occasion a task key can carry: its label reduced to lower-case letters and digits, then its month and day. */
export const occasionSuffixOf = (occasion: CareOccasion): string =>
    [
        occasion.label
            .normalize("NFD")
            .replaceAll(/[^a-zA-Z0-9]/g, "")
            .toLowerCase()
            .slice(0, 20),
        String(occasion.month),
        String(occasion.day),
    ]
        .filter((part) => part !== "")
        .join("-")

/** The occasion a task suffix names among the customer's, or undefined. */
export const occasionOfSuffix = (
    occasions: ReadonlyArray<CareOccasion>,
    suffix: string,
): CareOccasion | undefined => occasions.find((occasion) => occasionSuffixOf(occasion) === suffix)

/** The most records one care wake looks at. */
export const CARE_LIST_LIMIT = 20

const DAY_SHAPE = /^\d{4}-\d{2}-\d{2}$/
/** The hour of the day, Vietnam time, a delivery counts as made at when its check-in is planned (UTC 02:00 is 09:00 in Vietnam). */
const DELIVERY_CHECK_HOUR_UTC = 2
/** How far back a delivery day may be and still be read (the customer may say "today"), and how far ahead. */
const DELIVERY_PAST_MAX_MS = DAY_MS
const DELIVERY_AHEAD_MAX_DAYS = 90

/** The calendar day (`YYYY-MM-DD`) the model read the customer's delivery words as, when it is a real day close enough to be believed; else null. */
export const deliveryDayOf = (value: string | null, now: Date): string | null => {
    if (value === null || !DAY_SHAPE.test(value)) return null
    const at = Date.parse(`${value}T00:00:00.000Z`)
    if (Number.isNaN(at)) return null
    const nearEnough = at >= now.getTime() - DELIVERY_PAST_MAX_MS - DAY_MS && at <= now.getTime() + DELIVERY_AHEAD_MAX_DAYS * DAY_MS
    return nearEnough ? value : null
}

/** The moment to ask how the order was: the morning after the delivery day. */
export const deliveryCheckAtOf = (day: string): string =>
    new Date(Date.parse(`${day}T00:00:00.000Z`) + DAY_MS + DELIVERY_CHECK_HOUR_UTC * 3_600_000).toISOString()

/** How many times a check-in waits a day more for an order that has not shipped yet, when the delivery day is not known. */
export const SHIP_WAITS_MAX = 3

/** The suffix of a check-in whose delivery day is not known: `ship0` is the first look, `ship1` the one a day later. */
export const shipSuffixOf = (attempt: number): string => `ship${String(attempt)}`

/** The attempt a check-in suffix stands for, or null when the delivery day was known. */
export const shipAttemptOf = (suffix: string): number | null => {
    const match = /^ship(\d{1,2})$/.exec(suffix)
    return match === null ? null : Number(match[1])
}
