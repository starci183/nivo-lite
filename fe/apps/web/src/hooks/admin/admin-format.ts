import type { useFormatter } from "next-intl"
import type { AdminFormat, AdminText } from "./admin.shared"

/** The formatter next-intl hands to server and client code alike. */
type Formatter = ReturnType<typeof useFormatter>

const JUST_NOW_MS = 60_000

/** Builds the date, age and money formats of one page render, in the reader's locale and the product time zone. */
export const adminFormat = (format: Formatter, text: AdminText, now: Date): AdminFormat => ({
    date: (iso) => (iso === null ? text("empty") : format.dateTime(new Date(iso), { dateStyle: "medium" })),
    dateTime: (iso) =>
        iso === null ? text("empty") : format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }),
    ago: (iso) => {
        if (iso === null) return text("never")
        const at = new Date(iso)
        return now.getTime() - at.getTime() < JUST_NOW_MS ? text("justNow") : format.relativeTime(at, now)
    },
    vnd: (amount) => format.number(amount ?? 0, { style: "currency", currency: "VND", maximumFractionDigits: 0 }),
    usd: (amount) => format.number(amount, { style: "currency", currency: "USD" }),
    count: (value) => format.number(value),
})
