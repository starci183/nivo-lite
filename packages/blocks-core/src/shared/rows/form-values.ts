import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { textOf, valueAt } from "../slots/paths"
import { numberOf } from "./cell-format"

/** The kinds of field a form draws. */
export const FORM_KINDS = ["text", "number", "money", "textarea", "switch", "choice", "date"] as const

/** One kind of field. */
export type FormKind = (typeof FORM_KINDS)[number]

/** The value of one field: text, a number (null while empty), or a switch. */
export type FormValue = string | number | boolean | null

/** The values of a form, by field name. */
export type FormValues = Readonly<Record<string, FormValue>>

/** What the values of one field must satisfy. */
export interface FormFieldRule {
    /** The name the value is kept and submitted under. */
    readonly name: string
    /** The kind of field. */
    readonly kind: FormKind
    /** Whether the field must hold a value (a switch must be on). */
    readonly required?: boolean | undefined
    /** The longest text, or the largest number, the field takes. */
    readonly max?: number | undefined
    /** The values a choice field may hold. */
    readonly options?: ReadonlyArray<{ readonly value: string }> | undefined
}

/** The errors of a form, by field name. */
export type FormErrors = Readonly<Record<string, SpecText>>

/** A day as the date field takes it: year, month and day, separated by dashes. */
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** The length of a day written as year, month and day. */
const DAY_LENGTH = 10

/** The value of an empty field of the given kind. */
export const emptyValueOf = (kind: FormKind): FormValue => {
    if (kind === "number" || kind === "money") return null
    return kind === "switch" ? false : ""
}

/** How a stored value becomes the value of a field of each kind; a value that does not fit is an empty field. */
const READERS: Readonly<Record<FormKind, (stored: unknown) => FormValue>> = {
    text: textOf,
    textarea: textOf,
    choice: textOf,
    number: numberOf,
    money: numberOf,
    switch: (stored) => stored === true,
    date: (stored) => textOf(stored).slice(0, DAY_LENGTH),
}

/** The values a form starts with: what the record holds, and empty fields for a form with no record. */
export const initialValues = (rules: ReadonlyArray<FormFieldRule>, record: unknown): FormValues =>
    Object.fromEntries(rules.map((rule) => [rule.name, READERS[rule.kind](valueAt(record, rule.name))]))

/** The values with one field changed. */
export const withValue = (values: FormValues, name: string, value: FormValue): FormValues => ({
    ...values,
    [name]: value,
})

/** The number a number field reports: an emptied field reports not-a-number, which is no value. */
export const numberFromField = (reported: number): number | null => (Number.isNaN(reported) ? null : reported)

/** The number a number field is given: no value is not-a-number, which the field draws empty. */
export const numberForField = (value: FormValue | undefined): number => (typeof value === "number" ? value : Number.NaN)

/** Whether the text names a real day. */
const isRealDay = (text: string): boolean => DAY.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`))

/** The message for the value of a switch, or null when it is good. */
const switchError = (rule: FormFieldRule, value: FormValue | undefined): SpecText | null =>
    rule.required === true && value !== true ? { key: "formRequired" } : null

/** The message for the value of a number field, or null when it is good. */
const numberError = (rule: FormFieldRule, value: FormValue | undefined): SpecText | null => {
    if (typeof value !== "number") return rule.required === true ? { key: "formRequired" } : null
    return rule.max !== undefined && value > rule.max ? { key: "formTooBig" } : null
}

/** The message for the value of a text, choice or date field, or null when it is good. */
const textError = (rule: FormFieldRule, value: FormValue | undefined): SpecText | null => {
    const text = typeof value === "string" ? value.trim() : ""
    if (text === "") return rule.required === true ? { key: "formRequired" } : null
    if (rule.kind === "date") return isRealDay(text) ? null : { key: "formDateInvalid" }
    if (rule.kind === "choice") {
        return (rule.options ?? []).some((option) => option.value === text) ? null : { key: "formChoiceInvalid" }
    }
    return rule.max !== undefined && text.length > rule.max ? { key: "formTooLong" } : null
}

/** The message for one field's value, or null when the value is good. */
const errorOf = (rule: FormFieldRule, value: FormValue | undefined): SpecText | null => {
    if (rule.kind === "switch") return switchError(rule, value)
    if (rule.kind === "number" || rule.kind === "money") return numberError(rule, value)
    return textError(rule, value)
}

/** The errors of the values against the rules of the fields; empty when the form may be submitted. */
export const validateFields = (rules: ReadonlyArray<FormFieldRule>, values: FormValues): FormErrors =>
    Object.fromEntries(
        rules.flatMap((rule): ReadonlyArray<[string, SpecText]> => {
            const error = errorOf(rule, values[rule.name])
            return error === null ? [] : [[rule.name, error]]
        }),
    )

/** The values a submit sends: only the declared fields, with text trimmed. */
export const submittedValues = (rules: ReadonlyArray<FormFieldRule>, values: FormValues): FormValues =>
    Object.fromEntries(
        rules.map((rule): [string, FormValue] => {
            const value = values[rule.name] ?? emptyValueOf(rule.kind)
            return [rule.name, typeof value === "string" ? value.trim() : value]
        }),
    )

/** The errors with one field's error removed, for a field the person changed. */
export const withoutError = (errors: FormErrors, name: string): FormErrors =>
    Object.fromEntries(Object.entries(errors).filter(([field]) => field !== name))

/** The errors the form shows: the ones found here, and the server's, which win over them. */
export const mergedErrors = (found: FormErrors, answered: FormErrors): FormErrors => ({ ...found, ...answered })

/**
 * The slot a form draws its values from: a form with no record, or none found, is a form to fill, never an empty notice; a form
 * that requires a record keeps the empty slot, which the block draws as its idle notice.
 */
export const formRecordSlot = (slot: DataSlot<unknown>, requireRecord: boolean): DataSlot<unknown> =>
    "isEmpty" in slot && !requireRecord ? { items: {} } : slot

/** The id a submit carries: the id of the record being edited, and none for a form that creates. */
export const recordIdOf = (record: unknown, idPath: string): string => textOf(valueAt(record, idPath))
