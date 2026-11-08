import type { BookingAction, BookingDetailFact, BookingView } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"

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
const isMovable = (status: string): boolean =>
    status === "requested" || status === "confirmed" || status === "rescheduled"

/** The actions a booking offers in its current state, primary first. */
export const actionsOf = (status: string, checkedIn: boolean): ReadonlyArray<BookingAction> => {
    if (status === "requested") return ["confirm", "cancel"]
    if (status === "confirmed" || status === "rescheduled") {
        return [...(checkedIn ? [] : (["check-in"] as const)), "done", "no-show", "cancel"]
    }
    return []
}

/** The catalog key of each action label. */
const ACTION_KEY: Readonly<Record<BookingAction, string>> = {
    confirm: "act_confirm",
    "check-in": "act_check_in",
    done: "act_done",
    "no-show": "act_no_show",
    cancel: "act_cancel",
}

/** Whether the action is the one next step of a booking. */
const isNextAction = (action: BookingAction): boolean => action === "confirm" || action === "check-in"

/** A row of the agenda is a collection item: its next step is an alternative, never a commit. */
const rowIntent = (action: BookingAction): "alternative" | "neutral" =>
    isNextAction(action) ? "alternative" : "neutral"

/** The option that asks the booking writer to select an available resource instead of naming one. */
export const AUTO_RESOURCE = "auto"

/** The fields of the service form. */
export interface ServiceFields {
    readonly name: string
    readonly durationMin: number
    readonly bufferMin: number
    readonly price: string
    readonly resourceKind: string
    readonly followup: string
    readonly description: string
    readonly active: boolean
}

/** The initial values of a new booking service. */
export const BLANK_SERVICE_FIELDS: ServiceFields = {
    name: "",
    durationMin: 30,
    bufferMin: 0,
    price: "",
    resourceKind: "",
    followup: "",
    description: "",
    active: true,
}

/** Reads a whole VND or day count from its editable text. */
export const bookingServiceDigits = (value: string): number | null => {
    const only = value.replaceAll(/[^\d]/gu, "")
    return only === "" ? null : Number(only)
}

/** Stored service values whose amounts are converted to editable text. */
interface StoredServiceFields extends Omit<ServiceFields, "price" | "followup" | "resourceKind"> {
    readonly priceVnd: number | null
    readonly followupDays: number | null
    readonly resourceKind: string | null
}

/** Converts stored numeric amounts to the text fields owned by this form. */
export const serviceFieldsOf = (service: StoredServiceFields): ServiceFields => ({
    name: service.name,
    durationMin: service.durationMin,
    bufferMin: service.bufferMin,
    price: service.priceVnd === null ? "" : String(service.priceVnd),
    resourceKind: service.resourceKind ?? "",
    followup: service.followupDays === null ? "" : String(service.followupDays),
    description: service.description,
    active: service.active,
})

/** The fields of the exception form. */
export interface ExceptionFields {
    readonly resourceId: string
    readonly date: string
    readonly closed: boolean
    readonly start: string
    readonly end: string
    readonly note: string
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

/** A catalog reader: the key and its values. */
type Say = (key: string, values?: Record<string, string | number>) => string

/** What a row or a detail needs to turn a booking into words. */
interface DeskWords {
    readonly say: Say
    readonly resourceName: (id: string) => string
    readonly money: (value: number) => string
    /** The workspace the links of the desk lead within. */
    readonly workspaceId: string
}

const joined = (parts: ReadonlyArray<string>): string => parts.filter((part) => part !== "").join(" · ")

/** What `bookingRowOf` returns. */
interface BookingRowOfResult {
    id: string
    time: string
    status: {
        text: string
        tone: BadgeTone
    }
    flags: (
        | {
              text: string
              tone: "neutral"
          }
        | {
              text: string
              tone: "warning"
          }
    )[]
    who: string
    where: string
    actions: {
        id: "done" | "confirm" | "check-in" | "no-show"
        label: string
        intent: "neutral" | "alternative"
    }[]
}

/** One booking as the agenda draws it. */
export const bookingRowOf = (booking: BookingView, words: DeskWords, withActions: boolean): BookingRowOfResult => ({
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
              .map((action) => ({ id: action, label: words.say(ACTION_KEY[action]), intent: rowIntent(action) }))
        : [],
})

/** The facts of the detail dialog. */
const detailItems = (booking: BookingView, words: DeskWords): ReadonlyArray<BookingDetailFact> => {
    const none = words.say("none")
    const rows: ReadonlyArray<BookingDetailFact | null> = [
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
    return rows.filter((row): row is BookingDetailFact => row !== null)
}

/** The one next step of a booking, when its status has one: the dialog commits to it. */
const nextOf = (booking: BookingView, words: DeskWords) => {
    const action = actionsOf(booking.status, booking.checkedIn).find((action) => isNextAction(action))
    return action === undefined ? {} : { next: { id: action, label: words.say(ACTION_KEY[action]) } }
}

/** The detail dialog of a booking: its facts, status and the actions its status allows. */
export const detailOf = (
    booking: BookingView,
    words: DeskWords,
):
    | {
          actions: (
              | {
                    id: BookingAction
                    label: string
                    intent: "neutral" | "destructive"
                }
              | {
                    id: string
                    label: string
                    intent: "neutral"
                }
          )[]
          next?: never
          customerLabel: string
          customerHref?: string
          title: string
          description: string
          closeLabel: string
          statusLabel: string
          statusTone: BadgeTone
          items: readonly BookingDetailFact[]
      }
    | {
          actions: (
              | {
                    id: BookingAction
                    label: string
                    intent: "neutral" | "destructive"
                }
              | {
                    id: string
                    label: string
                    intent: "neutral"
                }
          )[]
          next: {
              id: BookingAction
              label: string
          }
          customerLabel: string
          customerHref?: string
          title: string
          description: string
          closeLabel: string
          statusLabel: string
          statusTone: BadgeTone
          items: readonly BookingDetailFact[]
      } => ({
    title: booking.customer === "" ? words.say("customerFallback") : booking.customer,
    description: booking.service,
    closeLabel: words.say("close"),
    statusLabel: words.say(`status_${booking.status}`),
    statusTone: BOOKING_STATUS_TONE[booking.status] ?? ("neutral" as const),
    items: detailItems(booking, words),
    customerLabel: words.say("viewCustomer"),
    ...nextOf(booking, words),
    actions: [
        ...actionsOf(booking.status, booking.checkedIn)
            .filter((action) => !isNextAction(action))
            .map((action) => ({
                id: action,
                label: words.say(ACTION_KEY[action]),
                intent: action === "cancel" ? ("destructive" as const) : ("neutral" as const),
            })),
        ...(isMovable(booking.status)
            ? [{ id: MOVE_ACTION, label: words.say("move"), intent: "neutral" as const }]
            : []),
    ],
})

/** The bookings of a range grouped by local day, oldest first. */
export const dayGroups = (
    bookings: ReadonlyArray<BookingView>,
): {
    id: string
    rows: BookingView[]
}[] => {
    const days = [...new Set(bookings.map((booking) => booking.date))].sort((left, right) => left.localeCompare(right))
    return days.map((day) => ({ id: day, rows: bookings.filter((booking) => booking.date === day) }))
}

/** What `placementLabelsOf` returns. */
interface PlacementLabelsOfResult {
    name: string
    phone: string
    service: string
    date: string
    time: string
    resource: string
    party: string
    note: string
    notePlaceholder: string
    force: string
    save: string
    cancel: string
    close: string
}

/** The field labels of the add and move dialog; `kind` picks the wording of the save button. */
export const placementLabelsOf = (say: Say, kind: "add" | "move"): PlacementLabelsOfResult => ({
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
