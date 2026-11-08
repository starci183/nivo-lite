import { useState, type ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { Alert, Button, Cluster, EmptyNotice, Fieldset, Form, Grid, SurfaceCard } from "@starci/grammar/common"
import type { listEditorBlock } from "../../blocks/list-editor.block"
import { cellContextOf } from "../../rows/cell-format"
import { formRecordSlot, mergedErrors, recordIdOf, type FormErrors, type FormValue } from "../../rows/form-values"
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
    type ListErrors,
    type ListRow,
} from "../../rows/list-rows"
import { FormFieldView, type FormFieldData } from "../composites/FormFieldView"
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

/** What every row of the editor shares: the spec, the words, the rows and what changes them. */
interface ListRowEnv {
    readonly spec: ListEditorProps["props"]
    readonly words: (text: SpecText) => string
    readonly rows: ReadonlyArray<ListRow>
    readonly currency: string
    readonly isLoading: boolean
    readonly isBusy: boolean
    /** The errors to show, by field key. */
    readonly shown: FormErrors
    readonly onChange: (position: number, key: number, name: string, value: FormValue) => void
    readonly onRestructure: (next: ReadonlyArray<ListRow>) => void
}

/** One row of the editor, and where it stands in the list. */
interface ListRowProps {
    readonly env: ListRowEnv
    readonly row: ListRow
    readonly position: number
}

/** One field of a row of the editor. */
interface ListFieldProps extends ListRowProps {
    readonly field: FormFieldData
}

/** One field of a row; its name carries the row's position so that two rows never share a field. */
const ListFieldView = (props: ListFieldProps): ReactNode => {
    const { env, row, position, field } = props
    const key = fieldKeyOf(position, field.name)
    const error = env.shown[key]
    return (
        <FormFieldView
            field={{ ...field, name: key }}
            value={row.values[field.name]}
            error={error === undefined ? undefined : env.words(error)}
            currency={env.currency}
            isLoading={env.isLoading}
            isBusy={env.isBusy}
            words={env.words}
            onChange={(value) => env.onChange(position, row.key, field.name, value)}
        />
    )
}

/** The commands of one row: move it up or down when the spec allows, and remove it. */
const ListRowControls = (props: ListRowProps): ReactNode => {
    const { env, row, position } = props
    const { spec, rows, words } = env
    const { moveUpLabel, moveDownLabel } = spec
    const minRows = spec.minRows ?? 0
    return (
        <Cluster gap="inline">
            {spec.isReorderable !== true || moveUpLabel === undefined || moveDownLabel === undefined ? null : (
                <>
                    <Button
                        intent="neutral"
                        size="sm"
                        isDisabled={position === 0 || env.isBusy}
                        onPress={() => env.onRestructure(moveRow(rows, row.key, -1))}
                    >
                        {words(moveUpLabel)}
                    </Button>
                    <Button
                        intent="neutral"
                        size="sm"
                        isDisabled={position === rows.length - 1 || env.isBusy}
                        onPress={() => env.onRestructure(moveRow(rows, row.key, 1))}
                    >
                        {words(moveDownLabel)}
                    </Button>
                </>
            )}
            <Button
                intent="neutral"
                size="sm"
                isDisabled={rows.length <= minRows || env.isBusy}
                onPress={() => env.onRestructure(removeRow(rows, row.key, minRows))}
            >
                {words(spec.removeLabel)}
            </Button>
        </Cluster>
    )
}

/** One row of the editor: its number and commands, and its fields. */
const ListRowView = (props: ListRowProps): ReactNode => (
    <Fieldset legend={String(props.position + 1)} actions={<ListRowControls {...props} />}>
        <Grid kind="form">
            {props.env.spec.fields.map((field) => (
                <ListFieldView key={field.name} {...props} field={field} />
            ))}
        </Grid>
    </Fieldset>
)

/** The rows, their errors and the save. It starts again from the record whenever the record changes. */
const ListEditorBody = (body: ListEditorBodyProps): ReactNode => {
    const { props } = body
    const spec = props.props
    const host = useBlockHost()
    const words = useBlockWords()
    const labels = useSlotLabels()
    const submit = props.slots.submit
    const [rows, setRows] = useState<ReadonlyArray<ListRow>>(() =>
        listRowsFrom(body.record, spec.listPath, spec.fields, spec.maxRows),
    )
    const [found, setFound] = useState<ListErrors>(NO_ERRORS)
    const [answered, setAnswered] = useState<FormErrors>({})
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
        const errors = validateRows(spec.fields, rows, spec.minRows ?? 0)
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
    const env: ListRowEnv = {
        spec,
        words,
        rows,
        currency: cellContextOf(host.locale(), spec.currency).currency,
        isLoading: body.isLoading,
        isBusy: submit.isRunning,
        shown: mergedErrors(found.fields, answered),
        onChange: change,
        onRestructure: restructure,
    }
    return (
        <Form label={words(spec.label)} validationBehavior="aria" isPending={submit.isRunning} onSubmit={send}>
            {found.list === null ? null : <Alert tone="negative" title={words(found.list)} />}
            {rows.length === 0 ? <EmptyNotice message={words(spec.emptyRows ?? { key: "listEditorEmpty" })} /> : null}
            {rows.map((row, position) => (
                <ListRowView key={row.key} env={env} row={row} position={position} />
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
                    intent="commit"
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
