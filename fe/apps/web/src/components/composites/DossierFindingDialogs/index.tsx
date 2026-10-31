import { parseDate } from "@internationalized/date"
import { Button, DateField, Dialog, Form, Select, Textarea } from "@starci/grammar/common"
import { NO_ASSIGNEE } from "@/hooks/brain"
import type {
    FindingAssignFieldsView,
    FindingDialogValues,
    FindingDialogView,
    FindingTextFieldView,
} from "@/hooks/brain"
import { FORM_CLASS_NAME } from "./classNames"

export type { FindingDialogValues, FindingDialogView } from "@/hooks/brain"

/** What one dialog says, asks and calls. */
interface DossierFindingDialogsProps {
    readonly props: FindingDialogView
    readonly on: {
        readonly submit: (values: FindingDialogValues) => void
        readonly close: () => void
    }
}

const textOf = (data: FormData, name: string): string => {
    const value = data.get(name)
    return typeof value === "string" ? value : ""
}

/** The text field of a dialog and whether the dialog is busy. */
interface TextFieldProps {
    readonly field: FindingTextFieldView
    readonly isPending: boolean
}

/** The member and due date fields of the assignment and whether the dialog is busy. */
interface AssignFieldsProps {
    readonly fields: FindingAssignFieldsView
    readonly isPending: boolean
}

/** The text field of a dialog; the person's answer is read from the form when they submit. */
const TextField = (props: TextFieldProps) => (
    <Textarea
        id="dossier-dialog-text"
        name="text"
        label={props.field.label}
        {...(props.field.hint === undefined ? {} : { description: props.field.hint })}
        rows={4}
        isRequired={props.field.isRequired}
        minLength={props.field.minLength}
        maxLength={props.field.maxLength}
        isDisabled={props.isPending}
    />
)

/** The member and the due date of an assignment. */
const AssignFields = (props: AssignFieldsProps) => (
    <>
        <Select
            label={props.fields.assigneeLabel}
            name="assigneeId"
            options={[{ id: NO_ASSIGNEE, label: props.fields.unassignedLabel }, ...props.fields.options]}
            defaultValue={props.fields.assigneeId}
            isDisabled={props.isPending}
        />
        <DateField
            label={props.fields.dueLabel}
            name="dueAt"
            defaultValue={props.fields.dueAt === null ? null : parseDate(props.fields.dueAt)}
            isDisabled={props.isPending}
        />
    </>
)

/**
 * The short focused task that blocks the page while a finding is dismissed, given to someone, marked done or sent to NIVO to
 * draft: one form whose commit sits in the footer and submits it by its id. The answer is read from the form, so the dialog
 * keeps no field state of its own.
 */
export const DossierFindingDialogs = (props: DossierFindingDialogsProps) => (
    <Dialog
        isOpen
        onOpenChange={(open) => {
            if (!open && !props.props.isPending) props.on.close()
        }}
        size="sm"
        title={props.props.title}
        closeLabel={props.props.closeLabel}
        isDismissable={!props.props.isPending}
        footer={
            <>
                <Button size="sm" intent="neutral" isDisabled={props.props.isPending} onPress={props.on.close}>
                    {props.props.cancelLabel}
                </Button>
                <Button
                    size="sm"
                    intent="commit"
                    type="submit"
                    form={props.props.formId}
                    isPending={props.props.isPending}
                >
                    {props.props.submitLabel}
                </Button>
            </>
        }
    >
        <Form
            id={props.props.formId}
            label={props.props.title}
            isPending={props.props.isPending}
            onSubmit={(data) =>
                props.on.submit({
                    text: textOf(data, "text"),
                    assigneeId: textOf(data, "assigneeId"),
                    dueAt: textOf(data, "dueAt"),
                })
            }
        >
            <div className={FORM_CLASS_NAME}>
                {props.props.text === null ? null : (
                    <TextField field={props.props.text} isPending={props.props.isPending} />
                )}
                {props.props.assign === null ? null : (
                    <AssignFields fields={props.props.assign} isPending={props.props.isPending} />
                )}
            </div>
        </Form>
    </Dialog>
)
