import type { ReactNode } from "react"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { Input, NumberField, Select, Switch, Textarea } from "@starci/grammar/common"
import type { z } from "zod"
import type { formBlock } from "../../blocks/form.block"
import { numberForField, numberFromField, type FormValue } from "../../rows/form-values"

/** The declaration of one field, as the form block and the blocks that edit values take it. */
export type FormFieldData = z.infer<(typeof formBlock)["props"]>["fields"][number]

/** What one field of a form is given. */
export interface FormFieldViewProps {
    readonly field: FormFieldData
    readonly value: FormValue | undefined
    readonly error: string | undefined
    readonly currency: string
    readonly isLoading: boolean
    readonly isBusy: boolean
    readonly words: (text: SpecText) => string
    readonly onChange: (value: FormValue) => void
}

/** What every kind of field takes the same way: its name, label, guidance and error. */
const fieldCommon = (props: FormFieldViewProps) => ({
    id: props.field.name,
    name: props.field.name,
    label: props.words(props.field.label),
    isRequired: props.field.required === true,
    isReadOnly: props.isBusy,
    ...(props.field.hint === undefined ? {} : { description: props.words(props.field.hint) }),
    ...(props.error === undefined ? {} : { errorMessage: props.error }),
})

/** One field of the form, drawn by the Grammar control of its kind. */
export const FormFieldView = (props: FormFieldViewProps): ReactNode => {
    const { field, value, isLoading } = props
    const common = fieldCommon(props)
    const text = typeof value === "string" ? value : ""
    switch (field.kind) {
        case "number":
        case "money":
            return (
                <NumberField
                    {...common}
                    isLoading={isLoading}
                    value={numberForField(value)}
                    onValueChange={(reported) => props.onChange(numberFromField(reported))}
                    {...(field.max === undefined ? {} : { maxValue: field.max })}
                    {...(field.kind === "money"
                        ? {
                              hideSteppers: true,
                              formatOptions: { style: "currency" as const, currency: props.currency },
                          }
                        : {})}
                />
            )
        case "textarea":
            return (
                <Textarea
                    {...common}
                    isLoading={isLoading}
                    value={text}
                    onValueChange={props.onChange}
                    {...(field.max === undefined ? {} : { maxLength: field.max })}
                />
            )
        case "switch":
            return (
                <Switch
                    {...common}
                    isLoading={isLoading}
                    isSelected={value === true}
                    onSelectedChange={props.onChange}
                />
            )
        case "choice":
            return (
                <Select
                    {...common}
                    isLoading={isLoading}
                    options={(field.options ?? []).map((option) => ({
                        id: option.value,
                        label: props.words(option.label),
                    }))}
                    value={text === "" ? null : text}
                    onValueChange={(chosen) => props.onChange(chosen ?? "")}
                />
            )
        case "date":
            return (
                <Input
                    {...common}
                    isLoading={isLoading}
                    placeholder={props.words({ key: "fieldDatePlaceholder" })}
                    value={text}
                    onValueChange={props.onChange}
                />
            )
        case "text":
            return <Input {...common} isLoading={isLoading} value={text} onValueChange={props.onChange} />
    }
}
