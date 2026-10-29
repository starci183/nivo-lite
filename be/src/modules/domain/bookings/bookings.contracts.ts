import type { ChatLink } from "./booking-chat.contracts"
import type { EntityManager } from "typeorm"
import type { SlotCheck } from "./policies/availability.policy"

/** A person, room or chair that serves customers; `capacity` customers can be served at the same moment. */
export interface BookingResource {
    /** The resource id. */
    readonly id: string
    /** The name shown to people. */
    readonly name: string
    /** The free-text kind (staff, room, chair, bay) a service asks for. */
    readonly kind: string
    /** How many customers the resource serves at the same moment. */
    readonly capacity: number
    /** Whether the resource takes bookings. */
    readonly active: boolean
    /** The display and tie-break order. */
    readonly sort: number
}

/** A weekly opening window of one resource. */
export interface WeeklyHours {
    /** The resource the window belongs to. */
    readonly resourceId: string
    /** The ISO weekday, 1 is Monday and 7 is Sunday. */
    readonly weekday: number
    /** The opening time, `HH:MM`. */
    readonly start: string
    /** The closing time, `HH:MM`. */
    readonly end: string
}

/** A closing or a different opening window on one date; a null `resourceId` is the whole business. */
export interface DateException {
    /** The resource, or null for the whole business. */
    readonly resourceId: string | null
    /** The local date, `YYYY-MM-DD`. */
    readonly date: string
    /** Whether the date is closed. */
    readonly closed: boolean
    /** The opening time of an open exception, `HH:MM`. */
    readonly start: string | null
    /** The closing time of an open exception, `HH:MM`. */
    readonly end: string | null
}

/** What the planner needs to know about a service. */
export interface ServiceSpec {
    /** The service id. */
    readonly id: string
    /** The visit length in minutes. */
    readonly durationMin: number
    /** The rest after the visit in minutes; the resource stays blocked for it. */
    readonly bufferMin: number
    /** The resource kind the service needs, or null for any resource. */
    readonly resourceKind: string | null
    /** Whether the service takes bookings. */
    readonly active: boolean
}

/** A booking, or an external block such as a leave, that takes `partySize` of a resource until `blockEndMs`. */
export interface TakenSpan {
    /** The booking id, or a synthetic id for an external block. */
    readonly id: string
    /** The resource the span takes. */
    readonly resourceId: string
    /** The start instant. */
    readonly startMs: number
    /** The instant the resource is free again, buffer included. */
    readonly blockEndMs: number
    /** How many customers the span holds. */
    readonly partySize: number
}

/** The business rules of the calendar. */
export interface BookingPolicy {
    /** The IANA time zone of the business. */
    readonly timezone: string
    /** The step between start times, in minutes. */
    readonly slotStepMin: number
    /** The earliest a customer may book, in minutes from now. */
    readonly minLeadMin: number
    /** How far ahead a customer may book, in days. */
    readonly maxAdvanceDays: number
}

/** One free start time on one resource. */
export interface FreeSlot {
    /** The start instant. */
    readonly startMs: number
    /** The end of the visit. */
    readonly endMs: number
    /** The end of the visit plus the buffer. */
    readonly blockEndMs: number
    /** The resource that takes the visit. */
    readonly resourceId: string
}

/** Why a start time cannot be taken, or `free`. */
export type SlotReason = "no_service" | "no_resource" | "too_soon" | "too_far" | "closed" | "full" | "free"

/** Everything the planner reads. */
export interface PlanInput {
    /** The service to plan. */
    readonly service: ServiceSpec
    /** Every resource of the business. */
    readonly resources: ReadonlyArray<BookingResource>
    /** The weekly hours of every resource. */
    readonly hours: ReadonlyArray<WeeklyHours>
    /** The date exceptions. */
    readonly exceptions: ReadonlyArray<DateException>
    /** The spans that already hold resources. */
    readonly taken: ReadonlyArray<TakenSpan>
    /** The business rules. */
    readonly policy: BookingPolicy
    /** The instant the plan is made. */
    readonly nowMs: number
    /** How many customers come; one when omitted. */
    readonly partySize?: number
    /** Only this resource, when a customer asks for one. */
    readonly resourceId?: string | null
    /** The booking being moved, which does not block itself. */
    readonly excludeId?: string | null
}

/** The statuses a booking moves through. */
export type BookingStatus = "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"

/** The statuses of a booking that is still ahead of the customer. */
export const ACTIVE_STATUSES: ReadonlyArray<BookingStatus> = ["requested", "confirmed", "rescheduled"]

/** The booking settings with defaults applied. */
export interface BookingSettings extends BookingPolicy {
    /** A change later than this many hours before the start is late. */
    readonly cancelWindowHours: number
    /** The deposit as a percentage of the price. */
    readonly depositPct: number
    /** The fee of a late cancellation as a percentage of the price. */
    readonly lateCancelFeePct: number
    /** The fee of a no-show, in VND. */
    readonly noShowFeeVnd: number
    /** Whether a free slot within the rules is confirmed without asking the owner. */
    readonly autoConfirm: boolean
    /** Whether a finished booking with a price becomes a sales order. */
    readonly handoffOrder: boolean
    /** The hours before the start at which reminders go out. */
    readonly reminderHours: ReadonlyArray<number>
    /** Whether the public page is on. */
    readonly publicEnabled: boolean
    /** The slug of the public page. */
    readonly publicSlug: string | null
    /** The note on the public page. */
    readonly publicNote: string
    /** The address of the business. */
    readonly address: string
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

/** A service the owner sells by appointment, as the public page and the desk list it. */
export interface BookableService extends ServiceSpec {
    /** The name shown to customers. */
    readonly name: string
    /** The description shown to customers. */
    readonly description: string
    /** The price in VND, or null when it has none. */
    readonly priceVnd: number | null
}

/** Everything the calendar of one workspace is made of. */
export interface BookingModel {
    /** The settings. */
    readonly settings: BookingSettings
    /** The services. */
    readonly services: ReadonlyArray<BookableService>
    /** The resources. */
    readonly resources: ReadonlyArray<BookingResource>
    /** The weekly hours. */
    readonly hours: ReadonlyArray<WeeklyHours>
    /** The date exceptions. */
    readonly exceptions: ReadonlyArray<DateException>
}

/** Which published page is asked for. */
export interface PublicPageParams {
    /** The slug of the page. */
    readonly slug: string
}

/** What the public booking page shows. */
export interface PublicPageView {
    /** The shop name. */
    readonly shop: string
    /** The slug of the page. */
    readonly slug: string
    /** The note of the owner. */
    readonly note: string
    /** The address of the business. */
    readonly address: string
    /** The IANA time zone of the business. */
    readonly timezone: string
    /** The active services. */
    readonly services: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly description: string
        readonly durationMin: number
        readonly priceVnd: number | null
    }>
}

/** The free start times of a service on a day. */
export interface PublicTimes {
    /** The start instants, ISO 8601. */
    readonly times: ReadonlyArray<string>
}

/** What a visitor of the public page asks for free times. */
export interface PublicTimesParams extends PublicPageParams {
    /** The service. */
    readonly service: string
    /** The local date, `YYYY-MM-DD`. */
    readonly date: string
    /** How many customers come. */
    readonly party: number
}

/** Asks for the same calendar availability from a workspace rather than a published page. */
export interface WorkspaceTimesParams extends Omit<PublicTimesParams, "slug"> {
    /** The workspace whose booking calendar to read. */ readonly workspaceId: string
}
/** The workspace facts chat tools use to resolve an active service and its local day. */
export interface WorkspaceBookingCatalog {
    /** The IANA timezone for dates without an explicit day. */ readonly timezone: string
    /** The active services the workspace offers. */ readonly services: ReadonlyArray<BookableService>
}
/** What a visitor of the public page sends to book. */
export interface PublicBookParams extends PublicPageParams {
    /** The service to book. */
    readonly serviceId: string
    /** The start instant, ISO 8601. */
    readonly start: string
    /** The customer name. */
    readonly name: string
    /** The customer phone. */
    readonly phone: string
    /** The customer email. */
    readonly email: string
    /** How many customers come. */
    readonly party: number
    /** The note of the customer. */
    readonly note: string
    /** The idempotency token of the form. */
    readonly token: string
    /** The honeypot field; a bot fills it. */
    readonly website: string
}
/** Records a validated customer request in the workspace calendar, independent of a public page. */
export interface WorkspaceBookParams extends Omit<PublicBookParams, "slug" | "website" | "token">, Partial<ChatLink> {
    /** The workspace that receives the request. */ readonly workspaceId: string
    /** The form token, or complete trusted chat key. */ readonly token: string
    /** The channel; chat keys already include their namespace. */ readonly sourceChannel: string
}
/** Carries validated booking facts into the reservation transaction. */
export interface BookingPlacementParams {
    /** The reservation transaction. */ readonly manager: EntityManager
    /** Settings and fallback resources for placement. */ readonly model: BookingModel
    /** The active service to book. */ readonly service: BookableService
    /** Whether the requested start has a free resource. */ readonly check: SlotCheck
    /** The requested start as epoch milliseconds. */ readonly startMs: number
    /** The instant used to schedule reminders. */ readonly nowMs: number
    /** The workspace request supplying channel, email and note. */ readonly request: WorkspaceBookParams
    /** The trimmed customer name. */ readonly name: string
    /** The validated, normalised customer phone. */ readonly phone: string
    /** The clamped party size. */ readonly party: number
    /** The key that recognizes a repeated request, or null. */ readonly key: string | null
}
/** A customer request successfully recorded in the calendar. */
export interface BookingPlaced {
    /** Identifies a recorded placement. */ readonly kind: "placed"
    /** The recorded booking id. */ readonly id: string
    /** Whether the booking holds a free slot. */ readonly free: boolean
}
/** A customer request that has no resource on which it can be recorded. */
export interface BookingUnplaced {
    /** Identifies failure to choose a resource. */ readonly kind: "no_resource"
}
/** The result of reserving or parking a workspace booking request. */
export type BookingPlacement = BookingPlaced | BookingUnplaced
/** How a public booking ended. */
export type PublicBookState = "confirmed" | "waiting" | "invalid" | "failed"
/** The word for the page to show, never prose. */
export type PublicBookCode =
    | "name_required"
    | "phone_invalid"
    | "start_invalid"
    | "service_unavailable"
    | "confirmed"
    | "received_free"
    | "received_taken"
    | "no_resource"
/** The answer to a public booking. */
export interface PublicBookResult {
    /** Whether the request was recorded. */
    readonly ok: boolean
    /** How the request ended. */
    readonly state: PublicBookState
    /** The word for the page to show. */
    readonly code: PublicBookCode
    /** The name of the service, empty when unknown. */
    readonly serviceName: string
    /** The requested start, ISO 8601, empty when unknown. */
    readonly startIso: string
    /** The nearest free starts to offer when the asked one was taken. */
    readonly alternatives: ReadonlyArray<string>
    /** The id of the recorded booking, or null. */
    readonly bookingId: string | null
}

/** The window of the overview. */
export interface OverviewParams {
    /** The workspace. */
    readonly workspaceId: string
    /** The first local date of the stats range, `YYYY-MM-DD`. */
    readonly from: string
    /** The last local date of the stats range, `YYYY-MM-DD`. */
    readonly to: string
    /** Only the figures of this booking agent instance. */
    readonly installationId?: string
}

/** The four figures of the workbench ribbon. */
export interface BookingFigures {
    /** Bookings that start today and are not cancelled. */
    readonly bookingsToday: number
    /** The no-show share of the finished bookings of 30 days, or null when none finished. */
    readonly noShowPct30d: number | null
    /** The finished bookings of 30 days. */
    readonly finished30d: number
    /** The booked share of the open time this week, or null when no resource has open hours. */
    readonly utilisationPct: number | null
    /** The bookings whose deposit is due. */
    readonly depositsPending: number
    /** The total of the deposits that are due, in VND. */
    readonly depositsPendingVnd: number
}

/** The statistics of the range. */
export interface BookingStats {
    /** Utilisation of each active resource. */
    readonly byResource: ReadonlyArray<{
        readonly resourceId: string
        readonly name: string
        readonly openMin: number
        readonly bookedMin: number
        readonly pct: number
    }>
    /** The bookings of the range by status. */
    readonly byStatus: Readonly<Record<string, number>>
    /** The no-show share of the finished bookings of the range. */
    readonly noShowPct: number
    /** The price total of the done bookings of the range, in VND. */
    readonly doneRevenueVnd: number
    /** The bookings of the range. */
    readonly total: number
}

/** The answer to an overview. */
export interface BookingOverview {
    /** The ribbon figures. */
    readonly figures: BookingFigures
    /** The statistics. */
    readonly stats: BookingStats
}

/** A booking the owner adds by hand. */
export interface AddBookingParams extends Omit<WorkspaceBookParams, "start" | "email" | "token" | "sourceChannel"> {
    /** The resource, empty to pick a free one. */
    readonly resourceId: string
    /** The local date, `YYYY-MM-DD`. */
    readonly date: string
    /** The local time, `HH:MM`. */
    readonly time: string
    /** Whether to take a slot that is taken. */
    readonly force: boolean
}

/** Why an owner action on the calendar was not done. */
export type DeskRefusal =
    | "service_required"
    | "name_required"
    | "datetime_invalid"
    | "service_not_found"
    | "closed"
    | "full"
    | "no_resource"
    | "taken"
    | "not_movable"
    | "resource_not_found"

/** The answer to an add or a move. */
export interface DeskPlacement {
    /** Whether the booking was placed. */
    readonly ok: boolean
    /** Why not, or null. */
    readonly reason: DeskRefusal | null
    /** The booking id for an add, or null. */
    readonly id: string | null
}

/** A booking the owner moves. */
export interface MoveBookingParams extends BookingRef {
    /** The new start instant, ISO 8601. */
    readonly startAt: string
    /** The new resource. */
    readonly resourceId: string
    /** Whether to take a slot that is taken. */
    readonly force: boolean
}

/** One booking of a workspace, named by an owner action. */
export interface BookingRef {
    /** The workspace. */
    readonly workspaceId: string
    /** The booking. */
    readonly id: string
}
/** The answer to a status change. */
export interface StatusChange {
    /** The status the booking has now. */
    readonly status: BookingStatus
    /** Whether a fee is due for the change. */
    readonly feeDue: boolean
}
/** Why a booking event was sent: it was created, its status changed, or its time or resource changed. */
export type BookingEventKind = "created" | "status" | "moved"
/** What a delivery of the event bus gives the inbox: the consumer's queue and the business key, claimed once per effect. */
export interface InboxClaim {
    /** The reactor's queue, the first half of the inbox key. */
    readonly consumer: string
    /** The business key of the fact, the second half. */
    readonly dedupeKey: string
}

/** One change of a booking, as `booking_status_changed` carries it (ids and codes only). */
export interface BookingEvent {
    /** The workspace of the booking. */
    readonly workspaceId: string
    /** The booking that changed. */
    readonly bookingId: string
    /** What kind of change it was, as the event carries it: one of `BOOKING_STATUS_CHANGED_KINDS`. */
    readonly kind: string
}

/** What applying one booking event did, for the job log. */
export interface BookingEffects {
    /** False when the booking no longer exists. */
    readonly found: boolean
    /** Whether reminders were planned (`planned`), stopped (`stopped`) or left alone (`none`). */
    readonly reminders: "planned" | "stopped" | "none"
    /** The fee recorded on the booking now, 0 when none. */
    readonly feeVnd: number
    /** Whether the finished booking was handed to the order chain. */
    readonly handedOff: boolean
    /** Whether the customer was told. */
    readonly notified: boolean
}

/** What decides the fee of a cancelled booking. */
export interface CancelFeeFacts {
    /** The price in VND, or null. */
    readonly price_vnd: number | null
    /** Why it was cancelled, or null. */
    readonly cancel_reason: string | null
    /** The start instant. */
    readonly start_ms: number
    /** The instant it was cancelled, or null. */
    readonly cancelled_ms: number | null
}

/** What decides the fee of a closed booking: its status and the facts of a cancellation. */
export interface ClosedBookingFacts extends CancelFeeFacts {
    /** The status now. */
    readonly status: string
}
