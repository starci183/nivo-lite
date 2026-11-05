import { useState } from "react"
import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import { Alert, Button, Cluster, EmptyNotice, Fieldset, Form, Grid, SurfaceCard } from "@starci/grammar/common"
import type { listEditorBlock } from "../../blocks/list-editor.block"
import { cellContextOf } from "../../rows/cell-format"
import { formRecordSlot, mergedErrors, recordIdOf } from "../../rows/form-values"
import type { FormErrors, FormValue } from "../../rows/form-values"
import {
    appendRow,
    fieldKeyOf,
    isListValid,
    listRowsFrom,
    moveRow,
    removeRow,
    submittedRows,
    validateRows,
    withoutFieldError,
    withRowValue,
} from "../../rows/list-rows"
import type { ListErrors, ListRow } from "../../rows/list-rows"
import { FormFieldView } from "../composites/FormFieldView"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

type ListEditorProps = RenderOf<typeof listEditorBlock>

/** What the filled editor needs: the record its list starts from, and whether that record is still arriving. */
interface ListEditorBodyProps {
    readonly props: ListEditorProps
    readonly record: unknown
    readonly isLoading: boolean
}

/** No error anywhere in the list. */
const NO_ERRORS: ListErrors = { fields: {}, list: null }

/** The rows, their errors and the save. It starts again from the record whenever the record changes. */
const ListEditorBody = (body: ListEditorBodyProps): ReactNode => {
    const { props } = body
    const spec = props.props
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const submit = props.slots.submit
    const minRows = spec.minRows ?? 0
    const [rows, setRows] = useState<ReadonlyArray<ListRow>>(() =>
        listRowsFrom(body.record, spec.listPath, spec.fields, spec.maxRows),
    )
    const [found, setFound] = useState<ListErrors>(NO_ERRORS)
    const [answered, setAnswered] = useState<FormErrors>({})
    const shown = mergedErrors(found.fields, answered)
    const restructure = (next: ReadonlyArray<ListRow>): void => {
        setRows(next)
        setFound(NO_ERRORS)
        setAnswered({})
    }
    const change = (position: number, key: number, name: string, value: FormValue): void => {
        setRows((current) => withRowValue(current, key, name, value))
        setFound((current) => ({ ...current, fields: withoutFieldError(current.fields, position, name) }))
        setAnswered((current) => withoutFieldError(current, position, name))
    }
    const send = (): void => {
        const errors = validateRows(spec.fields, rows, minRows)
        setFound(errors)
        setAnswered({})
        if (!isListValid(errors)) return
        submit
            .run({ id: recordIdOf(body.record, spec.idPath ?? "id"), values: submittedRows(spec.fields, rows) })
            .then((outcome) => {
                if (outcome.ok) {
                    if (spec.successNotice !== undefined) host.notify("success", words(spec.successNotice))
                    return
                }
                if (outcome.reason === "invalid") setAnswered(outcome.fields)
                else host.notify("danger", words(outcome.message))
            })
            .catch(() => host.notify("danger", labels.error))
    }
    const currency = cellContextOf(host.locale(), spec.currency).currency
    const { moveUpLabel, moveDownLabel } = spec
    return (
        <Form label={words(spec.label)} validationBehavior="aria" isPending={submit.isRunning} onSubmit={send}>
            {found.list === null ? null : <Alert tone="negative" title={words(found.list)} />}
            {rows.length === 0 ? <EmptyNotice message={words(spec.emptyRows ?? { key: "listEditorEmpty" })} /> : null}
            {rows.map((row, position) => (
                <Fieldset
                    key={row.key}
                    legend={String(position + 1)}
                    actions={
                        <Cluster gap="inline">
                            {spec.isReorderable !== true ||
                            moveUpLabel === undefined ||
                            moveDownLabel === undefined ? null : (
                                <>
                                    <Button
                                        intent="neutral"
                                        size="sm"
                                        isDisabled={position === 0 || submit.isRunning}
                                        onPress={() => restructure(moveRow(rows, row.key, -1))}
                                    >
                                        {words(moveUpLabel)}
                                    </Button>
                                    <Button
                                        intent="neutral"
                                        size="sm"
                                        isDisabled={position === rows.length - 1 || submit.isRunning}
                                        onPress={() => restructure(moveRow(rows, row.key, 1))}
                                    >
                                        {words(moveDownLabel)}
                                    </Button>
                                </>
                            )}
                            <Button
                                intent="neutral"
                                size="sm"
                                isDisabled={rows.length <= minRows || submit.isRunning}
                                onPress={() => restructure(removeRow(rows, row.key, minRows))}
                            >
                                {words(spec.removeLabel)}
                            </Button>
                        </Cluster>
                    }
                >
                    <Grid kind="form">
                        {spec.fields.map((field) => {
                            const key = fieldKeyOf(position, field.name)
                            const error = shown[key]
                            return (
                                <FormFieldView
                                    key={key}
                                    field={{ ...field, name: key }}
                                    value={row.values[field.name]}
                                    error={error === undefined ? undefined : words(error)}
                                    currency={currency}
                                    isLoading={body.isLoading}
                                    isBusy={submit.isRunning}
                                    words={words}
                                    onChange={(value) => change(position, row.key, field.name, value)}
                                />
                            )
                        })}
                    </Grid>
                </Fieldset>
            ))}
            <Cluster gap="inline">
                <Button
                    intent="neutral"
                    isDisabled={rows.length >= spec.maxRows || submit.isRunning}
                    onPress={() => restructure(appendRow(rows, spec.fields, spec.maxRows))}
                >
                    {words(spec.addLabel)}
                </Button>
                <Button
                    type="submit"
                    isPending={submit.isRunning}
                    isLoading={body.isLoading}
                    isDisabled={!submit.isAllowed}
                >
                    {words(spec.submitLabel)}
                </Button>
            </Cluster>
        </Form>
    )
}

/**
 * Repeated rows of declared fields. The rows start from the list of the bound record (no rows without a record); add, remove and
 * moving a row change the list in place, and a save sends the whole list as the values of the action.
 */
export const ListEditorBlock = (props: ListEditorProps): ReactNode => {
    const words = useBlockWords()
    const labels = useSlotLabels()
    const read = props.slots.record
    return (
        <SlotView
            slot={formRecordSlot(read.slot, false)}
            labels={labels}
            placeholder={{}}
            onRetry={read.retry}
            render={(record, isLoading) => (
                <SurfaceCard label={words(props.props.label)} headingLevel={2}>
                    <ListEditorBody key={JSON.stringify(record)} props={props} record={record} isLoading={isLoading} />
                </SurfaceCard>
            )}
        />
    )
}
