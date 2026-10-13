import type { RawBody } from "./billing.contracts"
import { BillingError, BillingErrorCode } from "./errors/billing.error"

/** A parsed JSON object whose values are not yet trusted. */
export interface JsonObject {
    readonly [name: string]: unknown
}

/** True for a JSON object: not null and not an array. */
export const isJsonObject = (value: unknown): value is JsonObject =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const parseJson = (raw: RawBody): unknown => {
    try {
        return JSON.parse(raw?.toString("utf8") ?? "")
    } catch (cause) {
        throw new BillingError({ code: BillingErrorCode.WebhookInvalid, cause })
    }
}

/**
 * The JSON object a provider posted, parsed from the exact bytes it signed. A provider signs its raw body, so the door hands the
 * raw bytes over and the intake parses them here; anything that is not a JSON object is an invalid delivery.
 */
export const parseJsonObject = (raw: RawBody): JsonObject => {
    const body = parseJson(raw)
    if (isJsonObject(body)) return body
    throw new BillingError({ code: BillingErrorCode.WebhookInvalid })
}

/** The value as text, or undefined when it is not text. */
export const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

/** The value as text, or null when it is not text. */
export const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** The value as a finite number (a numeric string counts), or undefined. */
export const numberOf = (value: unknown): number | undefined => {
    const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN
    return Number.isFinite(parsed) ? parsed : undefined
}
