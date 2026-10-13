import { shiftDate } from "@/modules/i18n"
import type { PublicBookingAnswer } from "@/modules/types"

/** How many days ahead the visitor can pick. */
const DAYS_AHEAD = 14

/** The days the page offers, today first. */
export const pageDays = (today: string): ReadonlyArray<string> =>
    Array.from({ length: DAYS_AHEAD }, (_, index) => shiftDate(today, index))

/** What the page shows after a send: the back end answered, or the call itself failed. */
export type PublicBookingResult =
    | { readonly kind: "answered"; readonly answer: PublicBookingAnswer }
    | { readonly kind: "failed"; readonly code: "busy" | "failed" | "offline" }

/** The catalog key of a send that did not reach an answer. */
const failedKeyOf = (code: "busy" | "failed" | "offline"): string => {
    if (code === "busy") return "publicBusy"
    if (code === "offline") return "publicOffline"
    return "publicFailed"
}

/** The catalog key of the message under a result (`code_*` and `public*` of workbenchBooking). */
export const resultKey = (result: PublicBookingResult): string => {
    if (result.kind === "failed") return failedKeyOf(result.code)
    const { answer } = result
    if (answer.code === "busy") return "publicBusy"
    if (answer.code === "") return "publicFailed"
    return `code_${answer.code}`
}

/** The `BOOKINGS_*` refusal codes of the back end as the `code_*` catalog keys the page shows. */
const PUBLIC_CODE_OF_ERROR: Readonly<Record<string, string>> = {
    BOOKINGS_NAME_REQUIRED: "name_required",
    BOOKINGS_PHONE_INVALID: "phone_invalid",
    BOOKINGS_DATETIME_INVALID: "start_invalid",
    BOOKINGS_SERVICE_NOT_FOUND: "service_unavailable",
    BOOKINGS_NO_RESOURCE: "no_resource",
}

/** The `code_*` catalog key of a back end refusal code, or `undefined` for a code the page has no message for. */
export const publicCodeOf = (errorCode: string): string | undefined => PUBLIC_CODE_OF_ERROR[errorCode]

/** The outcome states of a public booking request. */
const BOOKING_STATES = ["confirmed", "waiting", "invalid", "failed"] as const

/** The state of a public booking answer; an unknown state reads as a failure. */
export const bookingStateOf = (state: string): (typeof BOOKING_STATES)[number] =>
    BOOKING_STATES.find((known) => known === state) ?? "failed"

/** The free times to show: `null` while they load, none when they could not be read. */
export const timesOf = <T>(data: { readonly times: T[] } | undefined, error: unknown): T[] | null => {
    if (data !== undefined) return data.times
    return error === undefined ? null : []
}
