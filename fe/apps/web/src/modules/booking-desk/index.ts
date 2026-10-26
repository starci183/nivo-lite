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
