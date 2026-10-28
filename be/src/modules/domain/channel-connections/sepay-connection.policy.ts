import { parseJsonText } from "@modules/platform/primitives"
import type { SepayDeliveryReading, SepayRawBody } from "./sepay-connection.contracts"

const BULLETS = "\u2022".repeat(12)
const VISIBLE = 4
const DIRECTIONS: ReadonlyMap<unknown, "credit" | "debit"> = new Map([
    ["in", "credit"],
    ["out", "debit"],
])

/** The key as the page shows it: bullets and its last four characters; a key shorter than that shows bullets only. */
export const maskApiKey = (key: string): string =>
    key.length <= VISIBLE ? BULLETS : `${BULLETS}${key.slice(key.length - VISIBLE)}`

/** A parsed JSON object, or null when the bytes are not one. */
const objectOf = (raw: SepayRawBody): Record<string, unknown> | null => {
    if (raw === undefined) return null
    const read = parseJsonText(raw.toString("utf8"))
    if (!read.ok) return null
    const value = read.value
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : null
}

/** A finite number from a JSON number or numeric text, else null. */
const numberOrNull = (value: unknown): number | null => {
    const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null
}

/** The SePay transaction id as text, else null. */
const idOf = (value: unknown): string | null => {
    if (typeof value === "number" && Number.isSafeInteger(value)) return String(value)
    return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 80) : null
}

/**
 * What an authenticated SePay body says: `transferType` in with a positive amount is a credit, out a debit, and anything else a
 * delivery that moves no money (SePay's test ping). A body that is not a JSON object reads as such a ping.
 */
export const readSepayDelivery = (raw: SepayRawBody): SepayDeliveryReading => {
    const body = objectOf(raw)
    if (body === null) return { kind: "ping", amountVnd: null, providerEventId: null }
    const amount = body.transferAmount === undefined ? null : numberOrNull(body.transferAmount)
    const direction = DIRECTIONS.get(body.transferType)
    if (direction === undefined || amount === null || amount <= 0)
        return { kind: "ping", amountVnd: null, providerEventId: null }
    return { kind: direction, amountVnd: Math.round(amount), providerEventId: idOf(body.id) }
}
