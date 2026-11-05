import type { DateValue } from "@internationalized/date"
import { Alert, DateField, Input, Select, Textarea } from "@starci/grammar/common"
import { LeadDialogShell } from "@/components/composites/LeadDialogShell"
import type { LeadStepFormLabels, StepFormView } from "@/modules/types"

/** What the step dialog draws and does with a person's input. */
interface LeadStepDialogProps {
    readonly form: StepFormView | null
    readonly labels: LeadStepFormLabels
    readonly isPending: boolean
    readonly on: {
        readonly change: (field: "title" | "owner" | "nextAction", value: string) => void
        readonly changeDue: (value: DateValue | null) => void
        readonly submit: () => void
        readonly close: () => void
    }
}

/** The dialog that reassigns the next step, changes its due date or adds the step after a finished one. */
export const LeadStepDialog = (props: LeadStepDialogProps) => {
    const { form, labels, on } = props
    return (
        <LeadDialogShell
            isOpen={form !== null}
            title={form?.label ?? labels.title}
            closeLabel={labels.cancel}
            submitLabel={form?.submitLabel ?? labels.title}
            isPending={props.isPending}
            onClose={on.close}
            onSubmit={on.submit}
            fields={
                form === null ? null : (
                    <>
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
                    </>
                )
            }
        />
    )
}
