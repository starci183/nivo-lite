import { useState, type ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Button, Cluster, Form, Grid, Stack } from "@starci/grammar/common"
import type { formBlock } from "../../blocks/form.block"
import { cellContextOf } from "../../rows/cell-format"
import { formRecordSlot, recordIdOf } from "../../rows/form-values"
import { FormFieldView } from "../composites/FormFieldView"
import { SurfaceFrame } from "../composites/SurfaceFrame"
import { useFormValues } from "../composites/useFormValues"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

type FormProps = RenderOf<typeof formBlock>
/** What the filled form needs: the record it starts from, and whether that record is still arriving. */
interface FormBodyProps {
    readonly props: FormProps
    readonly record: unknown
    readonly isLoading: boolean
    /** Puts the fields back to the record: the cancel of the footer. */
    readonly onReset: () => void
}

/** The fields, their values and errors, and the submit. It starts again from the record whenever the record changes. */
const FormBody = (body: FormBodyProps): ReactNode => {
    const { props } = body
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const submit = props.slots.submit
    const form = useFormValues(props.props.fields, body.record)
    const send = (): void => {
        const values = form.check()
        if (values === null) return
        submit
            .run({ id: recordIdOf(body.record, props.props.idPath ?? "id"), values })
            .then((outcome) => {
                if (outcome.ok) {
                    if (props.props.successNotice !== undefined)
                        host.notify("success", words(props.props.successNotice))
                    return
                }
                if (outcome.reason === "invalid") form.answer(outcome.fields)
                else host.notify("danger", words(outcome.message))
            })
            .catch(() => host.notify("danger", labels.error))
    }
    const currency = cellContextOf(host.locale(), props.props.currency).currency
    const renderField = (field: FormProps["props"]["fields"][number]): ReactNode => {
        const error = form.errors[field.name]
        return (
            <FormFieldView
                key={field.name}
                field={field}
                value={form.values[field.name]}
                error={error === undefined ? undefined : words(error)}
                currency={currency}
                isLoading={body.isLoading}
                isBusy={submit.isRunning}
                words={words}
                onChange={(value) => form.change(field.name, value)}
            />
        )
    }
    const plain = props.props.fields.filter((field) => field.kind !== "switch")
    const switches = props.props.fields.filter((field) => field.kind === "switch")
    return (
        <Form label={words(props.props.label)} validationBehavior="aria" isPending={submit.isRunning} onSubmit={send}>
            <Grid kind="form">{plain.map((field) => renderField(field))}</Grid>
            {switches.length === 0 ? null : <Stack gap="row">{switches.map((field) => renderField(field))}</Stack>}
            <Cluster gap="inline" justify="end">
                <Button intent="neutral" isDisabled={submit.isRunning} onPress={body.onReset}>
                    {words({ key: "agentMessageCancel" })}
                </Button>
                <Button
                    type="submit"
                    intent="commit"
                    isPending={submit.isRunning}
                    isLoading={body.isLoading}
                    isDisabled={!submit.isAllowed}
                >
                    {words(props.props.submitLabel)}
                </Button>
            </Cluster>
        </Form>
    )
}

/**
 * Fields as data. A form with a bound record starts from it (its skeleton while the record arrives); a form with none is a blank
 * form to fill, never loading, unless the spec requires a record: then it says to choose one. The submit shows a spinner while it runs, and field errors from the answer sit on their fields.
 */
export const FormBlock = (props: FormProps): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels(props.props.idle ?? { key: "formIdle" })
    const read = props.slots.record
    const [resets, setResets] = useState(0)
    return (
        <SlotView
            slot={formRecordSlot(read.slot, props.props.requireRecord === true)}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => (
                <SurfaceFrame surface={props.props.surface ?? "section"} label={words(props.props.label)}>
                    <FormBody
                        key={`${resets}:${JSON.stringify(record)}`}
                        props={props}
                        record={record}
                        isLoading={isLoading}
                        onReset={() => setResets((count) => count + 1)}
                    />
                </SurfaceFrame>
            )}
        />
    )
}
