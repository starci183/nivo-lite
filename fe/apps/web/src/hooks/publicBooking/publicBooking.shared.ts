import { shiftDate } from "@/modules/i18n"
import type { PublicBookingAnswer } from "@/modules/types"

/** How many days ahead the visitor can pick. */
const DAYS_AHEAD = 14

/** The days the page offers, today first. */
export const pageDays = (today: string): ReadonlyArray<string> =>
    Array.from({ length: DAYS_AHEAD }, (_, index) => shiftDate(today, index))

/** What the page shows after a send: the database answered, or the call itself failed. */
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

/** A fresh token for one form: sending it twice books once. */
export const newToken = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now())
