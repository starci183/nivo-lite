import { ApiError, ApiErrorCode } from "./errors/api.error"

/** The envelope of a delivered event once its id and payload object are checked. */
export interface OpenedEnvelope {
    /** The stable event id. */
    readonly eventId: string
    /** The payload fields, unchecked. */
    readonly body: Readonly<Record<string, unknown>>
}

/** The own fields of an object that hold a value (a null field is an absent one on the wire) as a read-only record of unknown values. */
const recordOf = (source: object): Readonly<Record<string, unknown>> => {
    const record: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(source)) if (value !== null) record[name] = value
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

/** The listed value `value` equals, else the events error that names the field: a value outside its set never reaches a reactor. */
export const listedValue = <Member extends string>(
    members: ReadonlyArray<Member>,
    value: string,
    field: string,
): Member => {
    for (const member of members) if (member === value) return member
    throw new ApiError({ code: ApiErrorCode.ValueOutsideSet, params: { field } })
}

/** True when the field is absent or text: an optional text field of a payload. */
export const isTextOrAbsent = (value: unknown): value is string | undefined =>
    value === undefined || typeof value === "string"

/** True when the field is absent or a finite number: an optional amount of a payload. */
export const isAmountOrAbsent = (value: unknown): value is number | undefined =>
    value === undefined || (typeof value === "number" && Number.isFinite(value))

/** A payload field that is there only when it has a value: an empty object, or an object holding the value under its name. */
export type PresentField<Name extends string, Value> = { [Key in Name]?: Value }

/** A payload value that may be missing: the value itself, null or undefined. */
export type OptionalValue<Value> = Value | null | undefined

/** A one-field object holding `value` under `name`, or an empty one when the value is absent (undefined or null), to spread into an optional payload field. */
export const whenPresent = <Name extends string, Value>(
    name: Name,
    value: OptionalValue<Value>,
): PresentField<Name, NonNullable<Value>> => {
    const field: PresentField<Name, NonNullable<Value>> = {}
    if (value !== undefined && value !== null) field[name] = value
    return field
}
