import { isRecord, ok, refused, type Outcome } from "@modules/platform/primitives"
import { ConversationsErrorCode } from "./errors/conversations.error"

/** The JSON object of a webhook body. */
export type JsonObject = Readonly<Record<string, unknown>>

/** The JSON object a webhook delivered, or a refusal when the bytes are missing, are not JSON or are not an object. */
export const readJsonObject = (raw?: Buffer): Outcome<JsonObject, ConversationsErrorCode> => {
    if (raw === undefined) return refused(ConversationsErrorCode.NotAnswered)
    try {
        const parsed: unknown = JSON.parse(raw.toString("utf8"))
        return isRecord(parsed) && !Array.isArray(parsed) ? ok(parsed) : refused(ConversationsErrorCode.NotAnswered)
    } catch (cause) {
        return refused(ConversationsErrorCode.NotAnswered, { reason: String(cause) })
    }
}

/** A string field of an object, or an empty text. */
export const textField = (source: unknown, name: string): string => {
    const value = isRecord(source) ? source[name] : undefined
    return typeof value === "string" ? value : ""
}

/** A finite number field of an object, or NaN. */
export const numberField = (source: unknown, name: string): number => {
    const value = isRecord(source) ? source[name] : undefined
    return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN
}

/** A list field of an object, or an empty list when the field is missing or is not a list. */
export const listField = (source: unknown, name: string): ReadonlyArray<unknown> => {
    const value = isRecord(source) ? source[name] : undefined
    return Array.isArray(value) ? value : []
}

/** A time field of an object in epoch milliseconds, given as a number or as the digits of one; null when it is missing or is not a positive time. */
export const epochMillisField = (source: unknown, name: string): number | null => {
    const value = isRecord(source) ? source[name] : undefined
    const millis = typeof value === "string" && value.trim() !== "" ? Number(value) : value
    return typeof millis === "number" && Number.isFinite(millis) && millis > 0 ? millis : null
}
