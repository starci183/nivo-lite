const FENCE_START = /^```(?:json)?\s*/iu
const FENCE_END = /\s*```$/u

/** The outcome of reading JSON text: the value, or the error the parser raised. */
export type Parsed = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly cause: unknown }

/** Reads JSON text without throwing. */
export const parseJson = (text: string): Parsed => {
    try {
        return { ok: true, value: JSON.parse(text) }
    } catch (cause) {
        return { ok: false, cause }
    }
}

const asRecord = (text: string): Record<string, unknown> | null => {
    const parsed = parseJson(text)
    return parsed.ok && typeof parsed.value === "object" && parsed.value !== null && !Array.isArray(parsed.value)
        ? Object.fromEntries(Object.entries(parsed.value))
        : null
}

/** The JSON object a model answered, with or without a code fence or words around it; null when there is none. */
export const parseLooseJson = (raw: string): Record<string, unknown> | null => {
    const body = raw.replace(FENCE_START, "").replace(FENCE_END, "").trim()
    const whole = asRecord(body)
    if (whole !== null) return whole
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    return start >= 0 && end > start ? asRecord(body.slice(start, end + 1)) : null
}

/** A text field of a parsed model answer, trimmed; empty when it is missing or not text. */
export const textField = (object: Record<string, unknown> | null, key: string): string => {
    const value = object?.[key]
    return typeof value === "string" ? value.trim() : ""
}

/** The text entries of a list field of a parsed model answer. */
export const textList = (object: Record<string, unknown> | null, key: string): Array<string> => {
    const value = object?.[key]
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
}
