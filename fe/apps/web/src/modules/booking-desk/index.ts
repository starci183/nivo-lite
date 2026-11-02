import type { BookingAction } from "@/modules/types"

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

/** The catalog key of each action label. */
export const ACTION_KEY: Readonly<Record<BookingAction, string>> = {
    confirm: "act_confirm",
    "check-in": "act_check_in",
    done: "act_done",
    "no-show": "act_no_show",
    cancel: "act_cancel",
}

/** Whether the action is the one next step of a booking. */
export const isNextAction = (action: BookingAction): boolean => action === "confirm" || action === "check-in"

/** A row of the agenda is a collection item: its next step is an alternative, never a commit. */
export const rowIntent = (action: BookingAction): "alternative" | "neutral" =>
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
    const only = value.replace(/[^\d]/gu, "")
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
