import type {
    BookingCancelArgs,
    BookingFindSlotsArgs,
    BookingRequestArgs,
    BookingServiceCandidate,
    ToolArgs,
} from "@modules/domain/agent-tools"

export { isPlausibleBookingPhone, normaliseBookingPhone } from "@modules/domain/bookings"

const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/u
const ISO_START =
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u

const textOf = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

const validDate = (value: string): boolean => {
    if (!DATE_TEXT.test(value)) return false
    const ms = Date.parse(`${value}T00:00:00.000Z`)
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
}

const dateOf = (value: unknown): string | null => {
    if (typeof value !== "string") return null
    const date = value.trim()
    return validDate(date) ? date : null
}

const startOf = (value: unknown): string => {
    if (typeof value !== "string") return ""
    const start = value.trim()
    return ISO_START.test(start) && validDate(start.slice(0, 10)) && Number.isFinite(Date.parse(start)) ? start : ""
}

const partyOf = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.min(20, Math.max(1, Math.round(value) || 1)) : 1

const serviceText = (value: string): string =>
    value
        .trim()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/\u0111/gu, "d")

/** Reads today's calendar date in the shop's timezone when a slot search omits its date. */
export const bookingDateIn = (nowMs: number, timezone: string): string => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(nowMs))
    const year = parts.find((part) => part.type === "year")?.value ?? ""
    const month = parts.find((part) => part.type === "month")?.value ?? ""
    const day = parts.find((part) => part.type === "day")?.value ?? ""
    return `${year}-${month}-${day}`
}

/** Reads a chat availability query without coercing untrusted values; an absent or invalid date lets the caller use the shop's today. */
export const readBookingFindSlotsArgs = (args: ToolArgs): BookingFindSlotsArgs => ({
    service: textOf(args.service, 160),
    date: dateOf(args.date),
    party: partyOf(args.party_size),
})

/** Reads a chat booking request; an invalid ISO instant stays empty so placement answers start_invalid. */
export const readBookingRequestArgs = (args: ToolArgs): BookingRequestArgs => ({
    service: textOf(args.service, 160),
    start: startOf(args.slot),
    name: textOf(args.contact_name, 120),
    phone: textOf(args.contact, 40),
    party: partyOf(args.party_size),
    note: textOf(args.note, 400),
})

/** Reads the phone used to book and the customer's optional cancellation reason. */
export const readBookingCancelArgs = (args: ToolArgs): BookingCancelArgs => ({
    phone: textOf(args.contact, 40),
    reason: textOf(args.reason, 400),
})

/** Resolves an active service by folded exact name before containment, or the sole active service when no name is supplied. */
export const resolveBookingService = <T extends BookingServiceCandidate>(
    services: ReadonlyArray<T>,
    query: string,
): T | undefined => {
    const active = services.filter((service) => service.active)
    const folded = serviceText(query)
    if (folded === "") return active.length === 1 ? active[0] : undefined
    return (
        active.find((service) => serviceText(service.name) === folded) ??
        active.find((service) => serviceText(service.name).includes(folded))
    )
}
