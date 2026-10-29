/** The identity and payload of an envelope that has the basic shape. */
export interface EnvelopeParts {
    /** The stable id of the event. */
    readonly eventId: string
    /** The payload as the publisher sent it. */
    readonly payload: object
}

/** A property of an object read as unknown, or undefined when the object lacks it. */
export const fieldOf = (source: object, name: string): unknown =>
    name in source ? Reflect.get(source, name) : undefined

/** The value when it is text, else null. */
export const textOf = (value: unknown): string | null => (typeof value === "string" ? value : null)

/** The value when it is a non-blank text, else null. */
export const keyOf = (value: unknown): string | null =>
    typeof value === "string" && value.trim() !== "" ? value : null

/** The value when it is a finite number, else null. */
export const numberOf = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null

/** Splits an envelope into its event id and payload; a malformed one answers null. */
export const envelopeParts = (envelope: unknown): EnvelopeParts | null => {
    if (typeof envelope !== "object" || envelope === null) return null
    const eventId = keyOf(fieldOf(envelope, "eventId"))
    const payload = fieldOf(envelope, "payload")
    if (eventId === null || typeof payload !== "object" || payload === null) return null
    return { eventId, payload }
}
