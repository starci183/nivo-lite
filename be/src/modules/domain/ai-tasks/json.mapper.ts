/** A JSON object whose members are not known yet. */
export interface JsonRecord {
    /** Any member. */
    readonly [key: string]: unknown
}

/** A record or nothing. */
export type OptionalJsonRecord = JsonRecord | null

/** True for a JSON object: not null, not an array. */
export const isJsonRecord = (value: unknown): value is JsonRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The model's answer without a surrounding code fence. */
export const unfenced = (raw: string): string => {
    const opened = raw.replace(/^```(?:json)?\s*/iu, "")
    return opened.replace(/```$/u, "").trim()
}

/** The first `{...}` block inside prose, or null when there is none. */
export const embeddedObject = (text: string): string | null => {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    return start >= 0 && end > start ? text.slice(start, end + 1) : null
}
