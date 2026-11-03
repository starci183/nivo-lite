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

export { numberOf, textOf, textOrNull } from "@modules/platform/primitives"
