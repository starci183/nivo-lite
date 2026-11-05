import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { JsonValue, SpecText } from "@nivo-lite/agent-sdk/schema"
import { isRecord } from "./json-shape"

const isJsonValue = (value: unknown): value is JsonValue => {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true
    if (Array.isArray(value)) return value.every(isJsonValue)
    return isRecord(value) && Object.values(value).every(isJsonValue)
}

const isSpecText = (value: unknown): value is SpecText =>
    isRecord(value) && (typeof value.key === "string" || (typeof value.vi === "string" && typeof value.en === "string"))

const isFields = (value: unknown): value is Readonly<Record<string, SpecText>> =>
    isRecord(value) && Object.values(value).every(isSpecText)

/** The `ActionResult` an action answered as JSON; null when the answer has no readable shape. */
export const actionResultOf = (answer: unknown): ActionResult | null => {
    if (!isRecord(answer)) return null
    const data = isJsonValue(answer.data) ? { data: answer.data } : {}
    if (answer.ok === true) return { ok: true, ...data }
    if (answer.ok !== false || !isSpecText(answer.message)) return null
    const { reason, message } = answer
    if (reason === "invalid")
        return { ok: false, reason, message, ...(isFields(answer.fields) ? { fields: answer.fields } : {}), ...data }
    if (reason === "forbidden" || reason === "conflict" || reason === "refused" || reason === "failed")
        return { ok: false, reason, message, ...data }
    return null
}
