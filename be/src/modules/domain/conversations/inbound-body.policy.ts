import { isRecord, ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
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
