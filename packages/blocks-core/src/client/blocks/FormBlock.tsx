import { useState } from "react"
import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { Button, Form, Grid, Input, NumberField, Select, SurfaceCard, Switch, Textarea } from "@starci/grammar/common"
import type { formBlock } from "../../blocks/form.block"
import { cellContextOf } from "../../rows/cell-format"
import {
    formRecordSlot,
    initialValues,
    mergedErrors,
    numberForField,
    numberFromField,
    recordIdOf,
    submittedValues,
    validateFields,
    withoutError,
    withValue,
} from "../../rows/form-values"
import type { FormErrors, FormValue, FormValues } from "../../rows/form-values"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

type FormProps = RenderOf<typeof formBlock>
type FieldData = FormProps["props"]["fields"][number]

/** What one field of the form is given. */
interface FieldViewProps {
    readonly field: FieldData
    readonly value: FormValue | undefined
    readonly error: string | undefined
    readonly currency: string
    readonly isLoading: boolean
    readonly isBusy: boolean
    readonly words: (text: SpecText) => string
    readonly onChange: (value: FormValue) => void
}

/** What every kind of field takes the same way: its name, label, guidance and error. */
const fieldCommon = (props: FieldViewProps) => ({
    id: props.field.name,
    name: props.field.name,
    label: props.words(props.field.label),
    isRequired: props.field.required === true,
    isReadOnly: props.isBusy,
    ...(props.field.hint === undefined ? {} : { description: props.words(props.field.hint) }),
    ...(props.error === undefined ? {} : { errorMessage: props.error }),
})

/** One field of the form, drawn by the Grammar control of its kind. */
const FieldView = (props: FieldViewProps): ReactNode => {
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
                    placeholder="YYYY-MM-DD"
                    value={text}
                    onValueChange={props.onChange}
                />
            )
        case "text":
            return <Input {...common} isLoading={isLoading} value={text} onValueChange={props.onChange} />
    }
}

/** What the filled form needs: the record it starts from, and whether that record is still arriving. */
interface FormBodyProps {
    readonly props: FormProps
    readonly record: unknown
    readonly isLoading: boolean
}

/** The fields, their values and errors, and the submit. It starts again from the record whenever the record changes. */
const FormBody = (body: FormBodyProps): ReactNode => {
    const { props } = body
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const submit = props.slots.submit
    const [values, setValues] = useState<FormValues>(() => initialValues(props.props.fields, body.record))
    const [errors, setErrors] = useState<FormErrors>({})
    const [answered, setAnswered] = useState<FormErrors>({})
    const shown = mergedErrors(errors, answered)
    const change = (name: string, value: FormValue): void => {
        setValues((current) => withValue(current, name, value))
        setErrors((current) => withoutError(current, name))
        setAnswered((current) => withoutError(current, name))
    }
    const send = (): void => {
        const found = validateFields(props.props.fields, values)
        setErrors(found)
        setAnswered({})
        if (Object.keys(found).length > 0) return
        submit
            .run({
                id: recordIdOf(body.record, props.props.idPath ?? "id"),
                values: submittedValues(props.props.fields, values),
            })
            .then((outcome) => {
                if (outcome.ok) {
                    if (props.props.successNotice !== undefined)
                        host.notify("success", words(props.props.successNotice))
                    return
                }
                if (outcome.reason === "invalid") setAnswered(outcome.fields)
                else host.notify("danger", words(outcome.message))
            })
            .catch(() => host.notify("danger", labels.error))
    }
    const currency = cellContextOf(host.locale(), props.props.currency).currency
    return (
        <Form label={words(props.props.label)} validationBehavior="aria" isPending={submit.isRunning} onSubmit={send}>
            <Grid kind="form">
                {props.props.fields.map((field) => {
                    const error = shown[field.name]
                    return (
                        <FieldView
                            key={field.name}
                            field={field}
                            value={values[field.name]}
                            error={error === undefined ? undefined : words(error)}
                            currency={currency}
                            isLoading={body.isLoading}
                            isBusy={submit.isRunning}
                            words={words}
                            onChange={(value) => change(field.name, value)}
                        />
                    )
                })}
            </Grid>
            <Button
                type="submit"
                width="fill-narrow"
                isPending={submit.isRunning}
                isLoading={body.isLoading}
                isDisabled={!submit.isAllowed}
            >
                {words(props.props.submitLabel)}
            </Button>
        </Form>
    )
}

/**
 * Fields as data. A form with a bound record starts from it (its skeleton while the record arrives); a form with none is a blank
 * form to fill, never loading. The submit shows a spinner while it runs, and field errors from the answer sit on their fields.
 */
export const FormBlock = (props: FormProps): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.record
    return (
        <SlotView
            slot={formRecordSlot(read.slot)}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => (
                <SurfaceCard label={words(props.props.label)} headingLevel={2}>
                    <FormBody key={JSON.stringify(record)} props={props} record={record} isLoading={isLoading} />
                </SurfaceCard>
            )}
        />
    )
}
