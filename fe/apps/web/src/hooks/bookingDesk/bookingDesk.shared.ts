import type { BadgeTone, DescriptionListItem } from "@starci/grammar/common"
import type { BookingAction, BookingView } from "@/modules/types"
import type { PlacementFields } from "./useBookingPlacement"

/** What the desk tells the owner after a command: a catalog code. */
export interface DeskNotice {
    readonly tone: "affirmative" | "negative"
    readonly code: string
}

/** The notice that follows each successful action. */
export const NOTICE_OF_ACTION: Readonly<Record<BookingAction, string>> = {
    confirm: "did_confirm",
    "check-in": "did_check_in",
    done: "did_done",
    "no-show": "did_no_show",
    cancel: "did_cancel",
}

/** The id of the detail action that opens the move dialog; it is not a status change. */
export const MOVE_ACTION = "move"

/** Whether a booking can still be moved. */
export const isMovable = (status: string): boolean =>
    status === "requested" || status === "confirmed" || status === "rescheduled"

/** The actions a booking offers in its current state, primary first. */
export const actionsOf = (status: string, checkedIn: boolean): ReadonlyArray<BookingAction> => {
    if (status === "requested") return ["confirm", "cancel"]
    if (status === "confirmed" || status === "rescheduled") {
        return [...(checkedIn ? [] : (["check-in"] as const)), "done", "no-show", "cancel"]
    }
    return []
}

/** The badge tone of each booking status. */
export const BOOKING_STATUS_TONE: Readonly<Record<string, BadgeTone>> = {
    requested: "warning",
    confirmed: "accent",
    rescheduled: "accent",
    done: "success",
    no_show: "danger",
    cancelled: "neutral",
}

const ACTION_KEY: Readonly<Record<BookingAction, string>> = {
    confirm: "act_confirm",
    "check-in": "act_check_in",
    done: "act_done",
    "no-show": "act_no_show",
    cancel: "act_cancel",
}

const actionVariant = (action: BookingAction): "primary" | "outline" | "danger-soft" => {
    if (action === "cancel") return "danger-soft"
    return action === "confirm" || action === "check-in" ? "primary" : "outline"
}

/** A catalog reader: the key and its values. */
export type Say = (key: string, values?: Record<string, string | number>) => string

/** What a row or a detail needs to turn a booking into words. */
export interface DeskWords {
    readonly say: Say
    readonly resourceName: (id: string) => string
    readonly money: (value: number) => string
}

const joined = (parts: ReadonlyArray<string>): string => parts.filter((part) => part !== "").join(" · ")

/** One booking as the agenda draws it. */
export const bookingRowOf = (booking: BookingView, words: DeskWords, withActions: boolean) => ({
    id: booking.id,
    time: `${booking.startClock}-${booking.endClock}`,
    status: {
        text: words.say(`status_${booking.status}`),
        tone: BOOKING_STATUS_TONE[booking.status] ?? ("neutral" as const),
    },
    flags: [
        ...(booking.checkedIn && booking.status !== "done"
            ? [{ text: words.say("flagArrived"), tone: "neutral" as const }]
            : []),
        ...(!booking.holdsSlot && booking.status === "requested"
            ? [{ text: words.say("flagOverlap"), tone: "warning" as const }]
            : []),
    ],
    who: joined([
        booking.customer === "" ? words.say("customerFallback") : booking.customer,
        booking.phone ?? "",
        booking.service,
    ]),
    where: joined([
        words.resourceName(booking.resourceId),
        booking.party > 1 ? words.say("rowParty", { n: booking.party }) : "",
        booking.priceVnd === null || booking.priceVnd === 0 ? "" : words.money(booking.priceVnd),
    ]),
    actions: withActions
        ? actionsOf(booking.status, booking.checkedIn)
              .filter((action) => action !== "cancel")
              .map((action) => ({ id: action, label: words.say(ACTION_KEY[action]), variant: actionVariant(action) }))
        : [],
})

/** The facts of the detail dialog. */
const detailItems = (booking: BookingView, words: DeskWords): ReadonlyArray<DescriptionListItem> => {
    const none = words.say("none")
    const rows: ReadonlyArray<DescriptionListItem | null> = [
        {
            id: "when",
            term: words.say("detailWhen"),
            description: `${booking.date} ${booking.startClock}-${booking.endClock}`,
        },
        { id: "resource", term: words.say("detailResource"), description: words.resourceName(booking.resourceId) },
        { id: "phone", term: words.say("detailPhone"), description: booking.phone ?? none },
        { id: "party", term: words.say("detailParty"), description: String(booking.party) },
        {
            id: "price",
            term: words.say("detailPrice"),
            description: booking.priceVnd === null ? none : words.money(booking.priceVnd),
        },
        booking.depositVnd > 0
            ? {
                  id: "deposit",
                  term: words.say("detailDeposit"),
                  description: `${words.money(booking.depositVnd)} (${words.say(booking.depositStatus === "paid" ? "depositPaid" : "depositDue")})`,
              }
            : null,
        booking.feeVnd > 0
            ? { id: "fee", term: words.say("detailFee"), description: words.money(booking.feeVnd) }
            : null,
        { id: "source", term: words.say("detailSource"), description: booking.source },
        booking.note === "" ? null : { id: "note", term: words.say("detailNote"), description: booking.note },
        booking.conflictNote === ""
            ? null
            : { id: "conflict", term: words.say("detailConflict"), description: booking.conflictNote },
    ]
    return rows.filter((row): row is DescriptionListItem => row !== null)
}

/** The detail dialog of a booking: its facts, status and the actions its status allows. */
export const detailOf = (booking: BookingView, words: DeskWords) => ({
    title: booking.customer === "" ? words.say("customerFallback") : booking.customer,
    description: booking.service,
    closeLabel: words.say("close"),
    statusLabel: words.say(`status_${booking.status}`),
    statusTone: BOOKING_STATUS_TONE[booking.status] ?? ("neutral" as const),
    items: detailItems(booking, words),
    ...(booking.leadId === null ? {} : { customerHref: `/leads/${booking.leadId}` }),
    customerLabel: words.say("viewCustomer"),
    actions: [
        ...actionsOf(booking.status, booking.checkedIn).map((action) => ({
            id: action,
            label: words.say(ACTION_KEY[action]),
            variant: actionVariant(action),
        })),
        ...(isMovable(booking.status)
            ? [{ id: MOVE_ACTION, label: words.say("move"), variant: "outline" as const }]
            : []),
    ],
})

/** The bookings of a range grouped by local day, oldest first. */
export const dayGroups = (bookings: ReadonlyArray<BookingView>) => {
    const days = [...new Set(bookings.map((booking) => booking.date))].sort((left, right) => left.localeCompare(right))
    return days.map((day) => ({ id: day, rows: bookings.filter((booking) => booking.date === day) }))
}

/** The field labels of the add and move dialog; `kind` picks the wording of the save button. */
export const placementLabelsOf = (say: Say, kind: "add" | "move") => ({
    name: say("fCustomer"),
    phone: say("fPhone"),
    service: say("fService"),
    date: say("fDate"),
    time: say("fTime"),
    resource: say("fResource"),
    party: say("fParty"),
    note: say("fNote"),
    notePlaceholder: say("notePlaceholder"),
    force: say("stackAnyway"),
    save: say(kind === "add" ? "add" : "save"),
    cancel: say("cancel"),
    close: say("close"),
})

/** The fields of a new booking: the first service, today at nine, any resource, one guest. */
export const blankPlacementOf = (serviceId: string, today: string): PlacementFields => ({
    serviceId,
    date: today,
    time: "09:00",
    resourceId: "",
    name: "",
    phone: "",
    party: 1,
    note: "",
    force: false,
})
