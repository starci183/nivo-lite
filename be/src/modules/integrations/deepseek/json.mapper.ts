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
export const unfenced = (raw: string): string =>
    raw
        .replace(/^```(?:json)?\s*/iu, "")
        .replace(/\s*```$/u, "")
        .trim()

/** The first `{...}` block inside prose, or null when there is none. */
export const embeddedObject = (text: string): string | null => {
    const start = text.indexOf("{")
    const end = text.lastIndexOf("}")
    return start >= 0 && end > start ? text.slice(start, end + 1) : null
}

/** A string member, or the fallback. */
export const stringMember = (record: JsonRecord, key: string, fallback: string): string => {
    const value = record[key]
    return typeof value === "string" ? value : fallback
}

/** A string member or null. */
export const optionalStringMember = (record: JsonRecord, key: string): string | null => {
    const value = record[key]
    return typeof value === "string" ? value : null
}

/** A finite number member, or the fallback. */
export const numberMember = (record: JsonRecord, key: string, fallback: number): number => {
    const value = record[key]
    return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

/** A list of strings (each item stringified); empty when the member is not a list. */
export const stringListMember = (record: JsonRecord, key: string): ReadonlyArray<string> => {
    const value = record[key]
    return Array.isArray(value) ? value.map(String) : []
}

/** A member that is itself an object, or an empty one. */
export const recordMember = (record: JsonRecord, key: string): JsonRecord => {
    const value = record[key]
    return isJsonRecord(value) ? value : {}
}

/** A member that is a list of objects; anything else in the list is dropped. */
export const recordListMember = (record: JsonRecord, key: string): ReadonlyArray<JsonRecord> => {
    const value = record[key]
    return Array.isArray(value) ? value.filter(isJsonRecord) : []
}
