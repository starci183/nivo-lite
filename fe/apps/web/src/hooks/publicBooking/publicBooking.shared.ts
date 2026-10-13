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

/** The catalog key of the message under a result (`code_*` and `public*` of workbenchBooking). */
export const resultKey = (result: PublicBookingResult): string => {
    if (result.kind === "failed")
        return result.code === "busy" ? "publicBusy" : result.code === "offline" ? "publicOffline" : "publicFailed"
    const { answer } = result
    if (answer.code === "busy") return "publicBusy"
    if (answer.code === "") return "publicFailed"
    return `code_${answer.code}`
}

/** The `BOOKINGS_*` refusal codes of the back end as the `code_*` catalog keys the page shows. */
export const PUBLIC_CODE_OF_ERROR: Readonly<Record<string, string>> = {
    BOOKINGS_NAME_REQUIRED: "name_required",
    BOOKINGS_PHONE_INVALID: "phone_invalid",
    BOOKINGS_DATETIME_INVALID: "start_invalid",
    BOOKINGS_SERVICE_NOT_FOUND: "service_unavailable",
    BOOKINGS_NO_RESOURCE: "no_resource",
}

/** A fresh token for one form: sending it twice books once. */
export const newToken = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())
