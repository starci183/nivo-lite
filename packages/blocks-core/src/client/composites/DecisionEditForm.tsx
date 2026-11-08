import { useState, type ReactNode } from "react"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { Alert, Button, Cluster, Form, Grid } from "@starci/grammar/common"
import { editFailure, type EditAnswer } from "../../rows/decision-commands"
import type { FormValues } from "../../rows/form-values"
import { FormFieldView, type FormFieldData } from "./FormFieldView"
import { useFormValues } from "./useFormValues"

/** The words of an edit form that are not its fields'. */
export interface DecisionEditWords {
    /** The name of the form. */
    readonly label: string
    /** The words on the button that sends the values. */
    readonly submit: string
    /** The words on the button that closes the form without sending. */
    readonly cancel: string
    /** Turns the words of a spec into the viewer's language. */
    readonly text: (text: SpecText) => string
}

/** What the inline edit form of a decision row is given. */
export interface DecisionEditFormProps {
    /** The fields the spec declares. */
    readonly fields: ReadonlyArray<FormFieldData>
    /** The row's draft, which the fields start from; fields start empty without it. */
    readonly draft: unknown
    /** The ISO 4217 code money fields are drawn in. */
    readonly currency: string
    readonly words: DecisionEditWords
    /** Sends the values and says how it ended. */
    readonly onSend: (values: FormValues) => Promise<EditAnswer>
    /** Closes the form: the person gave up, or the edit was saved. */
    readonly onClose: () => void
}

/** A small inline form of declared fields, to change the proposal of a decision before it is approved. */
export const DecisionEditForm = (props: DecisionEditFormProps): ReactNode => {
    const form = useFormValues(props.fields, props.draft)
    const [isRunning, setIsRunning] = useState(false)
    const [notice, setNotice] = useState<SpecText | null>(null)
    const send = (): void => {
        const values = form.check()
        if (values === null) return
        setIsRunning(true)
        setNotice(null)
        props
            .onSend(values)
            .then((answer) => {
                setIsRunning(false)
                if (answer.isDone) {
                    props.onClose()
                    return
                }
                form.answer(answer.fields)
                setNotice(answer.notice)
            })
            .catch(() => {
                setIsRunning(false)
                setNotice(editFailure.notice)
            })
    }
    return (
        <Form label={props.words.label} validationBehavior="aria" isPending={isRunning} onSubmit={send}>
            {notice === null ? null : <Alert tone="negative" title={props.words.text(notice)} />}
            <Grid kind="form">
                {props.fields.map((field) => {
                    const error = form.errors[field.name]
                    return (
                        <FormFieldView
                            key={field.name}
                            field={field}
                            value={form.values[field.name]}
                            error={error === undefined ? undefined : props.words.text(error)}
                            currency={props.currency}
                            isLoading={false}
                            isBusy={isRunning}
                            words={props.words.text}
                            onChange={(value) => form.change(field.name, value)}
                        />
                    )
                })}
            </Grid>
            <Cluster gap="inline">
                <Button type="submit" intent="commit" size="sm" isPending={isRunning}>
                    {props.words.submit}
                </Button>
                <Button intent="neutral" size="sm" isDisabled={isRunning} onPress={props.onClose}>
                    {props.words.cancel}
                </Button>
            </Cluster>
        </Form>
    )
}
