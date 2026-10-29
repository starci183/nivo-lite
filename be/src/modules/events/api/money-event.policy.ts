/** The envelope of a delivered event once its id and payload object are checked. */
export interface OpenedEnvelope {
    /** The stable event id. */
    readonly eventId: string
    /** The payload fields, unchecked. */
    readonly body: Readonly<Record<string, unknown>>
}

/** The own fields of an object as a read-only record of unknown values. */
const recordOf = (source: object): Readonly<Record<string, unknown>> => {
    const record: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(source)) record[name] = value
    return record
}

/** Opens an envelope far enough to read its fields; a malformed one answers null. */
export const openEnvelope = (envelope: unknown): OpenedEnvelope | null => {
    if (typeof envelope !== "object" || envelope === null || !("eventId" in envelope) || !("payload" in envelope)) {
        return null
    }
    const { eventId, payload } = envelope
    if (typeof eventId !== "string" || eventId.trim() === "" || typeof payload !== "object" || payload === null) {
        return null
    }
    return { eventId, body: recordOf(payload) }
}

/** True when the field is a non-empty text. */
export const isKey = (value: unknown): value is string => typeof value === "string" && value.trim() !== ""

/** True when the field is text. */
export const isText = (value: unknown): value is string => typeof value === "string"

/** True when the field is text or null. */
export const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

/** True when the field is a finite number or null. */
export const isAmountOrNull = (value: unknown): value is number | null =>
    value === null || (typeof value === "number" && Number.isFinite(value))

/** True when the field is one of the listed texts. */
export const isMember = <Member extends string>(members: ReadonlyArray<Member>, value: unknown): value is Member => {
    for (const member of members) if (member === value) return true
    return false
}
