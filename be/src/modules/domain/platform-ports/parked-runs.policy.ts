/** The record a run is about, as its trigger names it (`subject: { kind, id }`); empty texts when the trigger names none. */
export interface RunSubject {
    /** The kind of the record, for instance `sales.order`. */
    readonly kind: string
    /** The id of the record. */
    readonly id: string
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The subject a run's trigger names. */
export const subjectOfContext = (context: unknown): RunSubject => {
    const subject = isObject(context) ? context["subject"] : undefined
    return isObject(subject) ? { kind: textOf(subject["kind"]), id: textOf(subject["id"]) } : { kind: "", id: "" }
}

/** The message key of the words of a failure code. */
export const errorKeyOf = (code: string): string => `errors.${code}`

/** The most parked runs one list looks at. */
export const PARKED_LOOKED_AT = 100
