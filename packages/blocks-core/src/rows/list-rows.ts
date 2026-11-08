import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { valueAt } from "../slots/paths"
import {
    emptyValueOf,
    initialValues,
    validateFields,
    type FormErrors,
    type FormFieldRule,
    type FormKind,
    type FormValue,
    type FormValues,
} from "./form-values"

/** One kind of field of a row: the kinds of a form that a repeated row can hold. */
export type ListFieldKind = Extract<FormKind, "text" | "number" | "money" | "choice" | "switch">

/** The kinds of field a row of a list editor holds. */
export const LIST_FIELD_KINDS: ReadonlyArray<ListFieldKind> = ["text", "number", "money", "choice", "switch"]

/** The most rows one list holds, whatever the spec asks. */
export const LIST_ROWS_MAX = 100

/** The most fields one row holds. */
export const LIST_FIELDS_MAX = 8

/** One row being edited: a key that stays with the row while it moves, and its values by field name. */
export interface ListRow {
    /** Stays with the row through additions, removals and moves; unique in the list. */
    readonly key: number
    /** The values of the row's fields, by field name. */
    readonly values: FormValues
}

/** What is wrong with a list the person is editing, told where it shows: on a field of a row, or on the list as a whole. */
export interface ListErrors {
    /** The errors of the fields, by `<position>.<field name>`, the name a field is submitted under. */
    readonly fields: FormErrors
    /** What is wrong with the list as a whole; null when nothing is. */
    readonly list: SpecText | null
}

/** The key under which the field of the row at a position is sent, and its error is told. */
export const fieldKeyOf = (position: number, name: string): string => `${position}.${name}`

/** The row of one record of the list: its fields read from it, empty where it holds none. */
const rowOf = (rules: ReadonlyArray<FormFieldRule>, record: unknown, key: number): ListRow => ({
    key,
    values: initialValues(rules, record),
})

/** The rows a record holds at the path of its list, cut to the most the editor takes; no rows where the path holds no list. */
export const listRowsFrom = (
    record: unknown,
    listPath: string,
    rules: ReadonlyArray<FormFieldRule>,
    maxRows: number,
): ReadonlyArray<ListRow> => {
    const list = valueAt(record, listPath)
    if (!Array.isArray(list)) return []
    return list.slice(0, maxRows).map((item, index) => rowOf(rules, item, index))
}

/** The list with one more empty row at its end; a full list stays as it is. */
export const appendRow = (
    rows: ReadonlyArray<ListRow>,
    rules: ReadonlyArray<FormFieldRule>,
    maxRows: number,
): ReadonlyArray<ListRow> => {
    if (rows.length >= maxRows) return rows
    const key = rows.reduce((highest, row) => Math.max(highest, row.key), -1) + 1
    return [...rows, rowOf(rules, undefined, key)]
}

/** The list without the row of the key; a list at its fewest rows stays as it is. */
export const removeRow = (rows: ReadonlyArray<ListRow>, key: number, minRows: number): ReadonlyArray<ListRow> =>
    rows.length <= minRows ? rows : rows.filter((row) => row.key !== key)

/** The list with the row of the key one place earlier (`-1`) or later (`1`); a row at the edge stays where it is. */
export const moveRow = (rows: ReadonlyArray<ListRow>, key: number, step: -1 | 1): ReadonlyArray<ListRow> => {
    const from = rows.findIndex((row) => row.key === key)
    const to = from + step
    const moved = rows[from]
    const swapped = rows[to]
    if (moved === undefined || swapped === undefined) return rows
    return rows.map((row, index) => {
        if (index === from) return swapped
        return index === to ? moved : row
    })
}

/** The list with one field of the row of the key changed. */
export const withRowValue = (
    rows: ReadonlyArray<ListRow>,
    key: number,
    name: string,
    value: FormValue,
): ReadonlyArray<ListRow> =>
    rows.map((row) => (row.key === key ? { ...row, values: { ...row.values, [name]: value } } : row))

/** The message when the list holds fewer rows than it must. */
const TOO_FEW: SpecText = { key: "listTooFew" }

/** The errors of the rows against the rules of their fields, and of the list against its fewest rows. */
export const validateRows = (
    rules: ReadonlyArray<FormFieldRule>,
    rows: ReadonlyArray<ListRow>,
    minRows: number,
): ListErrors => ({
    fields: Object.fromEntries(
        rows.flatMap((row, position) =>
            Object.entries(validateFields(rules, row.values)).map(([name, error]): [string, SpecText] => [
                fieldKeyOf(position, name),
                error,
            ]),
        ),
    ),
    list: rows.length < minRows ? TOO_FEW : null,
})

/** Whether the list has no error. */
export const isListValid = (errors: ListErrors): boolean =>
    errors.list === null && Object.keys(errors.fields).length === 0

/** The values a save sends: the whole list, every declared field of every row under `<position>.<field name>`, text trimmed. */
export const submittedRows = (rules: ReadonlyArray<FormFieldRule>, rows: ReadonlyArray<ListRow>): FormValues =>
    Object.fromEntries(
        rows.flatMap((row, position) =>
            rules.map((rule): [string, FormValue] => {
                const value = row.values[rule.name] ?? emptyValueOf(rule.kind)
                return [fieldKeyOf(position, rule.name), typeof value === "string" ? value.trim() : value]
            }),
        ),
    )

/** The errors with the error of one field of a row removed, for a field the person changed. */
export const withoutFieldError = (errors: FormErrors, position: number, name: string): FormErrors =>
    Object.fromEntries(Object.entries(errors).filter(([key]) => key !== fieldKeyOf(position, name)))
