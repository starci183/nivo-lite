import { useState } from "react"
import {
    initialValues,
    mergedErrors,
    submittedValues,
    validateFields,
    withoutError,
    withValue,
} from "../../rows/form-values"
import type { FormErrors, FormFieldRule, FormValue, FormValues } from "../../rows/form-values"

/** The values of a form being filled, their errors, and the steps that change them. */
export interface FormState {
    /** The value of each field now. */
    readonly values: FormValues
    /** The errors shown: the ones found here, and the server's, which win over them. */
    readonly errors: FormErrors
    /** Sets one field, which clears the error of that field. */
    readonly change: (name: string, value: FormValue) => void
    /** Validates the values; the values to send when they are good, null (with the errors shown) when they are not. */
    readonly check: () => FormValues | null
    /** Shows the errors the server answered on their fields. */
    readonly answer: (fields: FormErrors) => void
}

/** Keeps the values of a form that starts from a record, with its errors; the form starts again when the caller changes its key. */
export const useFormValues = (rules: ReadonlyArray<FormFieldRule>, record: unknown): FormState => {
    const [values, setValues] = useState<FormValues>(() => initialValues(rules, record))
    const [found, setFound] = useState<FormErrors>({})
    const [answered, setAnswered] = useState<FormErrors>({})
    return {
        values,
        errors: mergedErrors(found, answered),
        change: (name, value) => {
            setValues((current) => withValue(current, name, value))
            setFound((current) => withoutError(current, name))
            setAnswered((current) => withoutError(current, name))
        },
        check: () => {
            const errors = validateFields(rules, values)
            setFound(errors)
            setAnswered({})
            return Object.keys(errors).length > 0 ? null : submittedValues(rules, values)
        },
        answer: setAnswered,
    }
}
