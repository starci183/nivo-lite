import type { CalendarDate, DateValue } from "@internationalized/date"
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames"
import { Alert, Button, DateField, Form, Input, Select, Textarea } from "@starci/grammar/common"

/** The form that reassigns a step, changes its due date or adds the next step. */
export interface StepFormView {
    readonly mode: "reassign" | "add" | "due"
    readonly label: string
    readonly title: string
    readonly owner: string
    readonly nextAction: string
    readonly due: CalendarDate | null
    readonly ownerOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly submitLabel: string
    readonly error: string | null
}

/** The words of the step form. */
export interface StepFormLabels {
    readonly title: string
    readonly owner: string
    readonly nextStep: string
    readonly due: string
    readonly saveFailTitle: string
    readonly cancel: string
}

/** What the step form does with a person's input. */
interface StepFormActions {
    readonly change: (field: "title" | "owner" | "nextAction", value: string) => void
    readonly changeDue: (value: DateValue | null) => void
    readonly submit: () => void
    readonly close: () => void
}

/** What the step form draws and does. */
type StepFormProps = {
    readonly form: StepFormView
    readonly labels: StepFormLabels
    readonly isPending: boolean
    readonly on: StepFormActions
}

/** The step form: a title (only when adding), an owner, a next action and a due date, with save and cancel. */
export const StepForm = (props: StepFormProps) => {
    const { form, labels, on } = props
    return (
        <Form label={form.label} onSubmit={on.submit} isPending={props.isPending}>
            <div className={FORM_CLASS_NAME}>
                {form.mode === "add" ? (
                    <Input
                        id="responsibility-title"
                        name="title"
                        label={labels.title}
                        value={form.title}
                        onValueChange={(value) => on.change("title", value)}
                        isRequired
                    />
                ) : null}
                {form.mode === "due" ? null : (
                    <>
                        <Select
                            label={labels.owner}
                            options={form.ownerOptions}
                            value={form.owner}
                            onValueChange={(value) => on.change("owner", value ?? "human")}
                        />
                        <Textarea
                            label={labels.nextStep}
                            rows={3}
                            value={form.nextAction}
                            onValueChange={(value) => on.change("nextAction", value)}
                            isRequired
                        />
                    </>
                )}
                <DateField label={labels.due} granularity="day" value={form.due} onValueChange={on.changeDue} />
                {form.error === null ? null : (
                    <Alert title={labels.saveFailTitle} description={form.error} tone="negative" />
                )}
                <div className={ACTIONS_CLASS_NAME}>
                    <Button intent="neutral" onPress={on.close} isDisabled={props.isPending}>
                        {labels.cancel}
                    </Button>
                    <Button intent="neutral" type="submit" isPending={props.isPending}>
                        {form.submitLabel}
                    </Button>
                </div>
            </div>
        </Form>
    )
}
