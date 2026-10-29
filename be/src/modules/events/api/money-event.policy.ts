/** The envelope of a delivered event once its id and payload object are checked. */
export interface OpenedEnvelope {
    /** The stable event id. */
    readonly eventId: string
    /** The payload fields, unchecked. */
    readonly body: Readonly<Record<string, unknown>>
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
    return { eventId, body: payload as Readonly<Record<string, unknown>> }
}

/** True when the field is a non-empty text. */
export const isKey = (value: unknown): value is string => typeof value === "string" && value.trim() !== ""

/** True when the field is text or null. */
export const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string"

/** True when the field is a finite number or null. */
export const isAmountOrNull = (value: unknown): value is number | null =>
    value === null || (typeof value === "number" && Number.isFinite(value))
